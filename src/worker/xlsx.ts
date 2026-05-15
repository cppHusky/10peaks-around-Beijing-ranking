import { BRANCHES, PEAK_INDEX, PEAKS } from "../shared/peaks";
import { decodeText, unzip } from "./zip";
import { columnToIndex, decodeXml, getTagContent, indexToColumn, parseAddress, parseAttrs, parseSharedStrings } from "./xml";

type WorkbookBundle = {
  cells: Map<string, Cell>;
  rows: Map<number, Map<number, Cell>>;
  styleIsGreen: boolean[];
  date1904: boolean;
};

type Cell = {
  address: string;
  column: number;
  row: number;
  style?: number;
  type?: string;
  raw?: string;
  text: string;
};

export type AttendanceRecord = {
  serial: number;
  phone: string;
  name: string;
  attend_time: string;
};

export type RawRecord = {
  source: string;
  start_date: string;
  end_date: string;
  phone: string;
  mask: number;
};

type Color = { rgb?: string; theme?: number; tint?: number; indexed?: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const THEME_ORDER = ["lt1", "dk1", "lt2", "dk2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];

const INDEXED_COLORS: Record<number, string> = {
  0: "000000",
  1: "FFFFFF",
  2: "FF0000",
  3: "00FF00",
  4: "0000FF",
  5: "FFFF00",
  6: "FF00FF",
  7: "00FFFF",
  8: "000000",
  9: "FFFFFF",
  10: "FF0000",
  11: "00FF00",
  12: "0000FF",
  13: "FFFF00",
  14: "FF00FF",
  15: "00FFFF",
  16: "800000",
  17: "008000",
  18: "000080",
  19: "808000",
  20: "800080",
  21: "008080",
  22: "C0C0C0",
  23: "808080",
  24: "9999FF",
  25: "993366",
  26: "FFFFCC",
  27: "CCFFFF",
  28: "660066",
  29: "FF8080",
  30: "0066CC",
  31: "CCCCFF",
  32: "000080",
  33: "FF00FF",
  34: "FFFF00",
  35: "00FFFF",
  36: "800080",
  37: "800000",
  38: "008080",
  39: "0000FF",
  40: "00CCFF",
  41: "CCFFFF",
  42: "CCFFCC",
  43: "FFFF99",
  44: "99CCFF",
  45: "FF99CC",
  46: "CC99FF",
  47: "FFCC99",
  48: "3366FF",
  49: "33CCCC",
  50: "99CC00",
  51: "FFCC00",
  52: "FF9900",
  53: "FF6600",
  54: "666699",
  55: "969696",
  56: "003366",
  57: "339966",
  58: "003300",
  59: "333300",
  60: "993300",
  61: "993366",
  62: "333399",
  63: "333333",
};

export async function parseAttendanceWorkbook(buffer: ArrayBuffer): Promise<AttendanceRecord[]> {
  const workbook = await readWorkbook(buffer);
  const records: AttendanceRecord[] = [];
  const serials = new Map<number, AttendanceRecord>();
  const phones = new Map<string, AttendanceRecord>();
  const maxRow = Math.max(...workbook.rows.keys());

  for (let row = 7; row <= maxRow; row++) {
    const serialText = cellText(workbook, `A${row}`);
    const name = cellText(workbook, `C${row}`).trim();
    const phone = normalizePhone(cellText(workbook, `D${row}`));
    const attendTimeText = cellText(workbook, `F${row}`).trim();
    const hasRealData = Boolean(name || phone || attendTimeText);

    if (!hasRealData) {
      continue;
    }

    if (!serialText.trim() || !name || !phone || !attendTimeText) {
      throw new Error(`报名表第 ${row} 行缺少序号、用户昵称、电话或报名时间`);
    }

    const serial = parseSerial(serialText, row);
    const attend_time = normalizeDateTime(attendTimeText, workbook.date1904, `报名表第 ${row} 行`);
    const record = { serial, phone, name, attend_time };

    const existingSerial = serials.get(serial);
    if (existingSerial) {
      throw new Error(`报名表序号重复：${serial}（${existingSerial.name} / ${name}）`);
    }

    const existingPhone = phones.get(phone);
    if (existingPhone) {
      throw new Error(`报名表电话重复：${phone}（${existingPhone.name} / ${name}）`);
    }

    serials.set(serial, record);
    phones.set(phone, record);
    records.push(record);
  }

  return records.sort((a, b) => a.serial - b.serial);
}

export async function parseActivityWorkbook(buffer: ArrayBuffer, source: string): Promise<RawRecord[]> {
  const workbook = await readWorkbook(buffer);
  const start_date = normalizeDate(cellText(workbook, "G3"), workbook.date1904, "活动开始日期 G3");
  const end_date = normalizeDate(cellText(workbook, "G4"), workbook.date1904, "活动结束日期 G4");
  const peakColumns = findPeakColumns(workbook);

  if (peakColumns.length === 0) {
    throw new Error("活动参与表第 6 行没有找到可识别的山峰列");
  }

  const aggregated = new Map<string, number>();
  const maxRow = Math.max(...workbook.rows.keys());

  for (let row = 7; row <= maxRow; row++) {
    const phone = normalizePhone(cellText(workbook, `D${row}`));
    if (!phone) continue;

    let mask = aggregated.get(phone) ?? 0;
    for (const { column, peakIndex } of peakColumns) {
      const cell = workbook.cells.get(`${indexToColumn(column)}${row}`);
      if (cell?.style !== undefined && workbook.styleIsGreen[cell.style]) {
        mask |= 1 << peakIndex;
      }
    }
    aggregated.set(phone, mask);
  }

  return [...aggregated.entries()].map(([phone, mask]) => ({ source, start_date, end_date, phone, mask }));
}

async function readWorkbook(buffer: ArrayBuffer): Promise<WorkbookBundle> {
  const files = await unzip(buffer);
  const workbookXml = decodeText(files.get("xl/workbook.xml"), "xl/workbook.xml");
  const sharedStringsXml = files.get("xl/sharedStrings.xml") ? decodeText(files.get("xl/sharedStrings.xml"), "xl/sharedStrings.xml") : undefined;
  const stylesXml = decodeText(files.get("xl/styles.xml"), "xl/styles.xml");
  const themeXml = files.get("xl/theme/theme1.xml")
    ? decodeText(files.get("xl/theme/theme1.xml"), "xl/theme/theme1.xml")
    : files.get("xl/theme/theme.xml")
      ? decodeText(files.get("xl/theme/theme.xml"), "xl/theme/theme.xml")
      : undefined;
  const sheetPath = resolveFirstSheetPath(files, workbookXml);
  const worksheetXml = decodeText(files.get(sheetPath), sheetPath);
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const { cells, rows } = parseWorksheet(worksheetXml, sharedStrings);
  const styleIsGreen = parseGreenStyles(stylesXml, themeXml);

  return {
    cells,
    rows,
    styleIsGreen,
    date1904: /date1904="1"|date1904="true"/.test(workbookXml),
  };
}

function resolveFirstSheetPath(files: Map<string, Uint8Array>, workbookXml: string): string {
  const sheetMatch = /<sheet\b[^>]*\br:id="([^"]+)"[^>]*\/>/.exec(workbookXml);
  const relationshipId = sheetMatch?.[1];
  const relsXml = files.get("xl/_rels/workbook.xml.rels")
    ? decodeText(files.get("xl/_rels/workbook.xml.rels"), "xl/_rels/workbook.xml.rels")
    : undefined;

  if (relationshipId && relsXml) {
    const relRegex = /<Relationship\b([^>]*?)\/>/g;
    let match: RegExpExecArray | null;
    while ((match = relRegex.exec(relsXml))) {
      const attrs = parseAttrs(match[1]);
      if (attrs.Id === relationshipId && attrs.Target) {
        const target = attrs.Target.startsWith("/") ? attrs.Target.slice(1) : attrs.Target;
        return target.startsWith("xl/") ? target : `xl/${target}`;
      }
    }
  }

  return "xl/worksheets/sheet1.xml";
}

function parseWorksheet(xml: string, sharedStrings: string[]): { cells: Map<string, Cell>; rows: Map<number, Map<number, Cell>> } {
  const cells = new Map<string, Cell>();
  const rows = new Map<number, Map<number, Cell>>();
  const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(xml))) {
    const attrs = parseAttrs(match[1]);
    const address = attrs.r;
    const parsedAddress = address ? parseAddress(address) : null;
    if (!address || !parsedAddress) continue;

    const content = match[2] ?? "";
    const raw = /<v>([\s\S]*?)<\/v>/.exec(content)?.[1];
    const text = resolveCellText(raw, attrs.t, content, sharedStrings);
    const cell: Cell = {
      address,
      column: parsedAddress.column,
      row: parsedAddress.row,
      style: attrs.s === undefined ? undefined : Number.parseInt(attrs.s, 10),
      type: attrs.t,
      raw: raw === undefined ? undefined : decodeXml(raw),
      text,
    };

    cells.set(address, cell);
    const rowCells = rows.get(cell.row) ?? new Map<number, Cell>();
    rowCells.set(cell.column, cell);
    rows.set(cell.row, rowCells);
  }

  return { cells, rows };
}

function resolveCellText(raw: string | undefined, type: string | undefined, content: string, sharedStrings: string[]): string {
  if (type === "inlineStr") {
    return [...content.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
  }

  if (raw === undefined) return "";
  const decoded = decodeXml(raw);
  if (type === "s") {
    return sharedStrings[Number.parseInt(decoded, 10)] ?? "";
  }
  return decoded;
}

function parseGreenStyles(stylesXml: string, themeXml: string | undefined): boolean[] {
  const theme = parseTheme(themeXml);
  const fills = parseFills(stylesXml).map((fill) => fill.some((color) => isGreen(resolveColor(color, theme))));
  const cellXfs = getTagContent(stylesXml, "cellXfs") ?? "";
  const styleIsGreen: boolean[] = [];
  const xfRegex = /<xf\b([^>]*?)(?:\/>|>[\s\S]*?<\/xf>)/g;
  let match: RegExpExecArray | null;

  while ((match = xfRegex.exec(cellXfs))) {
    const attrs = parseAttrs(match[1]);
    const fillId = attrs.fillId === undefined ? 0 : Number.parseInt(attrs.fillId, 10);
    styleIsGreen.push(Boolean(fills[fillId]));
  }

  return styleIsGreen;
}

function parseFills(stylesXml: string): Color[][] {
  const fillsContent = getTagContent(stylesXml, "fills") ?? "";
  const fills: Color[][] = [];
  const fillRegex = /<fill\b[^>]*>([\s\S]*?)<\/fill>/g;
  let match: RegExpExecArray | null;

  while ((match = fillRegex.exec(fillsContent))) {
    const colors: Color[] = [];
    const colorRegex = /<(?:fgColor|bgColor)\b([^>]*?)\/>/g;
    let colorMatch: RegExpExecArray | null;
    while ((colorMatch = colorRegex.exec(match[1]))) {
      const attrs = parseAttrs(colorMatch[1]);
      colors.push({
        rgb: attrs.rgb,
        theme: attrs.theme === undefined ? undefined : Number.parseInt(attrs.theme, 10),
        tint: attrs.tint === undefined ? undefined : Number.parseFloat(attrs.tint),
        indexed: attrs.indexed === undefined ? undefined : Number.parseInt(attrs.indexed, 10),
      });
    }
    fills.push(colors);
  }

  return fills;
}

function parseTheme(themeXml: string | undefined): Record<number, string> {
  if (!themeXml) return {};
  const theme: Record<number, string> = {};

  THEME_ORDER.forEach((name, index) => {
    const tag = new RegExp(`<a:${name}\\b[^>]*>([\\s\\S]*?)<\\/a:${name}>`).exec(themeXml)?.[1];
    if (!tag) return;
    const color = /<a:srgbClr\b[^>]*\bval="([0-9A-Fa-f]{6})"/.exec(tag)?.[1]
      ?? /<a:sysClr\b[^>]*\blastClr="([0-9A-Fa-f]{6})"/.exec(tag)?.[1];
    if (color) theme[index] = color;
  });

  return theme;
}

function resolveColor(color: Color, theme: Record<number, string>): string | undefined {
  let rgb = color.rgb;
  if (!rgb && color.indexed !== undefined) rgb = INDEXED_COLORS[color.indexed];
  if (!rgb && color.theme !== undefined) rgb = theme[color.theme];
  if (!rgb) return undefined;

  const hex = rgb.length === 8 ? rgb.slice(2) : rgb;
  if (color.tint === undefined || color.tint === 0) return hex.toUpperCase();
  return applyTint(hex, color.tint);
}

function applyTint(hex: string, tint: number): string {
  const [r, g, b] = rgbTuple(hex);
  const apply = (value: number) => {
    const next = tint < 0 ? value * (1 + tint) : value * (1 - tint) + 255 * tint;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return [apply(r), apply(g), apply(b)].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function isGreen(hex: string | undefined): boolean {
  if (!hex || !/^[0-9A-Fa-f]{6}$/.test(hex)) return false;
  const [r, g, b] = rgbTuple(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return false;

  const hue = rgbToHue(r, g, b);
  const saturation = (max - min) / max;
  return hue >= 70 && hue <= 170 && saturation >= 0.18 && g >= 100;
}

function rgbTuple(hex: string): [number, number, number] {
  const value = hex.length === 8 ? hex.slice(2) : hex;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHue(r: number, g: number, b: number): number {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return 0;
  if (max === red) return (60 * ((green - blue) / delta) + 360) % 360;
  if (max === green) return 60 * ((blue - red) / delta + 2);
  return 60 * ((red - green) / delta + 4);
}

function findPeakColumns(workbook: WorkbookBundle): Array<{ column: number; peakIndex: number }> {
  const headerRow = workbook.rows.get(6);
  if (!headerRow) return [];

  const mappings: Array<{ column: number; peakIndex: number }> = [];
  for (const [column, cell] of headerRow.entries()) {
    if (column < columnToIndex("H")) continue;
    const title = cell.text.trim();
    if (!title) continue;
    const peak = PEAKS.find((name) => title.includes(name));
    if (!peak) continue;
    mappings.push({ column, peakIndex: PEAK_INDEX.get(peak)! });
  }

  return mappings;
}

function cellText(workbook: WorkbookBundle, address: string): string {
  return workbook.cells.get(address)?.text ?? "";
}

function normalizePhone(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function parseSerial(value: string, row: number): number {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`报名表第 ${row} 行序号不是整数：${value}`);
  }
  return Number.parseInt(normalized, 10);
}

function normalizeDate(value: string, date1904: boolean, label: string): string {
  const normalized = normalizeDateTime(value, date1904, label);
  return normalized.slice(0, 10);
}

function normalizeDateTime(value: string, date1904: boolean, label: string): string {
  const text = value.trim();
  if (!text) throw new Error(`${label} 为空`);

  if (/^-?\d+(?:\.\d+)?$/.test(text)) {
    return excelSerialToDateTime(Number.parseFloat(text), date1904);
  }

  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/.exec(text);
  if (!match) {
    throw new Error(`${label} 不是可识别的日期时间：${value}`);
  }

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return `${year}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
}

function excelSerialToDateTime(serial: number, date1904: boolean): string {
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(base + Math.round(serial * DAY_MS));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

function pad2(value: string | number): string {
  return String(value).padStart(2, "0");
}

export function describePeakCoverage(): string {
  return BRANCHES.map((branch) => `${branch.name}:${branch.peaks.length}`).join(", ");
}
