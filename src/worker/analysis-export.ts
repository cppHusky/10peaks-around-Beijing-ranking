import { BRANCHES, PEAKS, branchCounts, hasPeak } from "../shared/peaks";
import type { ActivityExportRow, ParticipantExportRow } from "./db";

const encoder = new TextEncoder();

export function createAnalysisExport(
  participants: ParticipantExportRow[],
  activities: ActivityExportRow[],
  exportedAt: string,
): ArrayBuffer {
  const participantIds = new Map(participants.map((row) => [row.phone, `p_${crypto.randomUUID()}`]));

  const participantHeaders = [
    "参与者匿名编号",
    "用户昵称",
    "是否报名十峰挑战赛",
    "报名日期",
    "最终打卡总数",
    "东灵山（已完成，排名资格）",
    ...PEAKS.map((peak) => `${peak}（最终完成）`),
    ...BRANCHES.map((branch) => `支线：${branch.name}（全部完成）`),
  ];
  const participantRows = participants.map((row) => [
    participantIds.get(row.phone)!,
    row.name,
    row.is_registered === 1,
    row.registration_date,
    row.total_count,
    row.mask === null ? null : hasPeak(row.mask, 0),
    ...PEAKS.map((_, index) => row.mask === null ? null : hasPeak(row.mask, index)),
    ...(row.mask === null ? BRANCHES.map(() => null) : branchCounts(row.mask).map((count, index) => count === BRANCHES[index].peaks.length)),
  ]);

  const activityHeaders = [
    "参与者匿名编号",
    "活动名称",
    "活动开始日期",
    "活动结束日期",
    "是否报名十峰挑战赛",
    "符合计入资格",
    "资格判断说明",
    "本次活动打卡数",
    ...PEAKS.map((peak) => `${peak}（本次活动打卡）`),
  ];
  const activityRows = activities.map((row) => {
    const eligible = row.eligible === 1;
    return [
      participantIds.get(row.phone)!,
      activityName(row.source),
      row.start_date,
      row.end_date,
      row.is_registered === 1,
      eligible,
      row.eligible === null
        ? "未报名十峰挑战赛"
        : row.eligible === 1
          ? "报名日期不晚于活动结束次日"
          : "报名日期晚于活动结束次日",
      PEAKS.reduce((count, _, index) => count + (hasPeak(row.mask, index) ? 1 : 0), 0),
      ...PEAKS.map((_, index) => hasPeak(row.mask, index)),
    ];
  });

  const readme = [
    "京畿十峰挑战赛分析数据",
    `导出时间：${exportedAt}`,
    "",
    "文件说明",
    "- participants.csv：每位在报名表或活动表出现的人一行；参与者匿名编号为本次导出随机生成，用户昵称列仅报名者有值。",
    "- activities.csv：每人在每个活动表中的一条记录；参与者匿名编号可与 participants.csv 关联，包含已报名和未报名者。活动名称直接取上传文件名（去除 .xlsx 后缀）。",
    "- 两个 CSV 均为 UTF-8 编码，首行为中文字段名；是/否表示布尔状态。日期格式为 YYYY-MM-DD。",
    "",
    "字段说明",
    "- 参与者匿名编号：本次导出随机生成，用于在两个 CSV 之间关联参与者；用户昵称与它共同用于识别报名者。是否报名为“否”的记录没有昵称、报名日期，最终统计及最终山峰状态留空。",
    "- 报名日期：仅保留日期，不含时分秒。最终打卡总数是最终计入的不同山峰数量；各山峰列是最终汇总状态。",
    "- “（本次活动打卡）”列表示该活动表中的打卡状态；支线列表示是否完成该支线全部山峰。",
    "- 符合计入资格：未报名者不符合资格；已报名者按报名日期是否不晚于活动结束日期的次日判断。资格判断说明提供中文原因。",
    "- activities.csv 包含所有活动表记录，包括未报名者以及没有任何山峰打卡的记录。",
    "",
    "山峰及支线顺序",
    ...BRANCHES.flatMap((branch, branchIndex) => [
      `支线 ${branchIndex + 1}：${branch.name}`,
      ...branch.peaks.map((peak) => `  ${PEAKS.indexOf(peak) + 1}. ${peak}`),
    ]),
    "",
    "隐私说明：导出包含报名者用户昵称（如果报名了十峰），不包含手机号。匿名编号仅在本次导出数据内部关联，再次导出数据时编号会发生变化。",
  ].join("\n");

  const archive = createZip([
    { name: "participants.csv", content: csv(participantHeaders, participantRows) },
    { name: "activities.csv", content: csv(activityHeaders, activityRows) },
    { name: "README.txt", content: readme },
  ]);
  const output = new ArrayBuffer(archive.byteLength);
  new Uint8Array(output).set(archive);
  return output;
}

function csv(headers: unknown[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

function csvCell(value: unknown): string {
  let text = typeof value === "boolean" ? (value ? "是" : "否") : String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function activityName(source: string): string {
  return source.replace(/\.xlsx$/i, "");
}

type ZipEntry = { name: string; content: string };

function createZip(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);

  const output = new Uint8Array(localOffset + centralSize + end.length);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
