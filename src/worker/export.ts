import * as XLSX from "xlsx";
import { BRANCHES, branchCounts, hasPeak } from "../shared/peaks";
import type { LeaderboardRow } from "./db";

const HEADERS = [
  "报名序号",
  "用户昵称",
  "是否完赛",
  "总打卡数",
  "完成支线数",
  "打卡东灵山",
  ...BRANCHES.map((branch) => `支线-${branch.name}`),
];

export function createLeaderboardWorkbook(rows: LeaderboardRow[]): ArrayBuffer {
  const values = rows.map((row) => {
    const counts = branchCounts(row.mask);
    const completedBranches = counts.filter((count, index) => count === BRANCHES[index].peaks.length).length;

    return [
      row.serial,
      row.name,
      isFinished(row) ? "是" : "否",
      row.total_count,
      completedBranches,
      hasPeak(row.mask, 0) ? "是" : "否",
      ...counts.map((count, index) => count === BRANCHES[index].peaks.length ? "是" : "否"),
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...values]);
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 24 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    ...BRANCHES.map(() => ({ wch: 15 })),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "排行榜");
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", compression: true });
  const bytes = output instanceof Uint8Array ? output : new Uint8Array(output);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function isFinished(row: LeaderboardRow): boolean {
  return hasPeak(row.mask, 0) && row.total_count >= 10;
}
