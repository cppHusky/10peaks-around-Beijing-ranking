import { PEAKS } from "../shared/peaks";
import type { AttendanceRecord, RawRecord } from "./xlsx";
import type { D1Database, D1PreparedStatement } from "./types";

export type SourceKind = "attendance" | "activity";

export type SourceRow = {
  kind: SourceKind;
  name: string;
  r2_key: string;
  size: number;
  uploaded_at: string;
  status: "ready" | "pending" | "failed";
};

export type SourceMetadata = Pick<SourceRow, "kind" | "name" | "r2_key" | "size" | "uploaded_at">;

export type SourceList = {
  attendance: SourceRow | null;
  activities: SourceRow[];
};

export type LeaderboardRow = {
  serial: number;
  name: string;
  mask: number;
  total_count: number;
};

export type SourcePublishResult = {
  affected: string[];
  oldSource: SourceRow | null;
};

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS attendance (
    serial INTEGER PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    attend_time TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS raw (
    source TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    phone TEXT NOT NULL,
    mask INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (source, phone)
  )`,
  `CREATE INDEX IF NOT EXISTS raw_phone_end_idx ON raw (phone, end_date)`,
  `CREATE INDEX IF NOT EXISTS raw_source_idx ON raw (source)`,
  `CREATE TABLE IF NOT EXISTS "final" (
    phone TEXT PRIMARY KEY,
    mask INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (phone) REFERENCES attendance(phone) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS final_total_idx ON "final" (total_count DESC)`,
  `CREATE TABLE IF NOT EXISTS sources (
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    r2_key TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (kind, name)
  )`,
  `CREATE INDEX IF NOT EXISTS sources_status_idx ON sources (kind, status, name)`,
];

const MASK_BITS = Array.from({ length: PEAKS.length }, (_, index) => 1 << index);
const FINAL_MASK_SQL = MASK_BITS.map((bit) => `COALESCE(MAX(r.mask & ${bit}), 0)`).join(" | ") || "0";
const FINAL_TOTAL_SQL = MASK_BITS.map((bit) => `CASE WHEN COALESCE(MAX(r.mask & ${bit}), 0) != 0 THEN 1 ELSE 0 END`).join(" + ") || "0";
const FINAL_JOIN_SQL = `LEFT JOIN raw r ON r.phone = a.phone AND date(a.attend_time) <= date(r.end_date, '+1 day')`;

export async function ensureSchema(db: D1Database): Promise<void> {
  for (const statement of SCHEMA) {
    await db.prepare(statement).run();
  }
}

export async function listReadySources(db: D1Database): Promise<SourceList> {
  await ensureSchema(db);
  const rows = await db
    .prepare(
      `SELECT kind, name, r2_key, size, uploaded_at, status
       FROM sources
       WHERE status = 'ready'
       ORDER BY kind ASC, uploaded_at DESC, name ASC`,
    )
    .all<SourceRow>();
  const sources = rows.results ?? [];
  return {
    attendance: sources.find((source) => source.kind === "attendance") ?? null,
    activities: sources.filter((source) => source.kind === "activity"),
  };
}

export async function getReadySource(db: D1Database, kind: SourceKind, name: string): Promise<SourceRow | null> {
  await ensureSchema(db);
  return db
    .prepare(
      `SELECT kind, name, r2_key, size, uploaded_at, status
       FROM sources
       WHERE kind = ?1 AND name = ?2 AND status = 'ready'`,
    )
    .bind(kind, name)
    .first<SourceRow>();
}

export async function publishAttendanceSource(db: D1Database, source: SourceMetadata, records: AttendanceRecord[]): Promise<SourceRow | null> {
  await ensureSchema(db);
  const oldSource = await getReadySource(db, "attendance", source.name);
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM "final"`),
    db.prepare(`DELETE FROM attendance`),
    ...records.map((record) => {
      return db
        .prepare(`INSERT INTO attendance (serial, phone, name, attend_time) VALUES (?1, ?2, ?3, ?4)`)
        .bind(record.serial, record.phone, record.name, record.attend_time);
    }),
    insertAllFinalStatement(db),
    upsertSourceStatement(db, source),
  ];

  await runAtomicBatch(db, statements);
  return oldSource;
}

export async function publishRawSource(db: D1Database, source: SourceMetadata, records: RawRecord[]): Promise<SourcePublishResult> {
  await ensureSchema(db);
  const oldSource = await getReadySource(db, "activity", source.name);
  const oldRows = await db.prepare(`SELECT phone FROM raw WHERE source = ?1`).bind(source.name).all<{ phone: string }>();
  const affected = new Set<string>((oldRows.results ?? []).map((row) => row.phone));
  records.forEach((record) => affected.add(record.phone));
  const affectedPhones = [...affected];

  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM raw WHERE source = ?1`).bind(source.name),
    ...records.map((record) => {
      return db
        .prepare(`INSERT INTO raw (source, start_date, end_date, phone, mask) VALUES (?1, ?2, ?3, ?4, ?5)`)
        .bind(record.source, record.start_date, record.end_date, record.phone, record.mask);
    }),
    ...finalRebuildStatements(db, affectedPhones),
    upsertSourceStatement(db, source),
  ];

  await runAtomicBatch(db, statements);
  return { affected: affectedPhones, oldSource };
}

export async function deleteAttendanceSource(db: D1Database, name: string): Promise<SourceRow | null> {
  await ensureSchema(db);
  const oldSource = await getReadySource(db, "attendance", name);
  await runAtomicBatch(db, [
    db.prepare(`DELETE FROM "final"`),
    db.prepare(`DELETE FROM attendance`),
    db.prepare(`DELETE FROM sources WHERE kind = 'attendance' AND name = ?1`).bind(name),
  ]);
  return oldSource;
}

export async function deleteRawSource(db: D1Database, source: string): Promise<SourcePublishResult> {
  await ensureSchema(db);
  const oldSource = await getReadySource(db, "activity", source);
  const oldRows = await db.prepare(`SELECT phone FROM raw WHERE source = ?1`).bind(source).all<{ phone: string }>();
  const affected = [...new Set((oldRows.results ?? []).map((row) => row.phone))];
  await runAtomicBatch(db, [
    db.prepare(`DELETE FROM raw WHERE source = ?1`).bind(source),
    ...finalRebuildStatements(db, affected),
    db.prepare(`DELETE FROM sources WHERE kind = 'activity' AND name = ?1`).bind(source),
  ]);
  return { affected, oldSource };
}

export async function clearAttendance(db: D1Database): Promise<void> {
  await deleteAttendanceSource(db, "attendance.xlsx");
}

export async function rebuildAllFinal(db: D1Database): Promise<void> {
  await ensureSchema(db);
  await runAtomicBatch(db, [db.prepare(`DELETE FROM "final"`), insertAllFinalStatement(db)]);
}

export async function rebuildFinalForPhones(db: D1Database, phones: string[]): Promise<void> {
  await ensureSchema(db);
  await runAtomicBatch(db, finalRebuildStatements(db, [...new Set(phones)].filter(Boolean)));
}

export type PeakActivity = {
  source: string;
  start_date: string;
  end_date: string;
  counted: number;
};

export async function getPeakActivities(db: D1Database, serial: number, peakBit: number): Promise<PeakActivity[]> {
  await ensureSchema(db);
  const rows = await db
    .prepare(
      `SELECT r.source, r.start_date, r.end_date,
              CASE WHEN date(a.attend_time) <= date(r.end_date, '+1 day') THEN 1 ELSE 0 END AS counted
       FROM raw r
       JOIN attendance a ON a.phone = r.phone
       WHERE a.serial = ?1 AND (r.mask & ?2) != 0
       ORDER BY r.start_date`,
    )
    .bind(serial, peakBit)
    .all<PeakActivity>();
  return rows.results ?? [];
}

export async function getLeaderboard(db: D1Database): Promise<LeaderboardRow[]> {
  await ensureSchema(db);
  const rows = await db
    .prepare(
      `SELECT a.serial, a.name, f.mask, f.total_count
       FROM "final" f
       JOIN attendance a ON a.phone = f.phone
       WHERE f.total_count > 0
       ORDER BY f.total_count DESC, a.serial ASC`,
    )
    .all<LeaderboardRow>();
  return rows.results ?? [];
}

function finalRebuildStatements(db: D1Database, phones: string[]): D1PreparedStatement[] {
  return phones.flatMap((phone) => [
    db.prepare(`DELETE FROM "final" WHERE phone = ?1`).bind(phone),
    insertFinalForPhoneStatement(db, phone),
  ]);
}

function insertFinalForPhoneStatement(db: D1Database, phone: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO "final" (phone, mask, total_count)
       SELECT a.phone, ${FINAL_MASK_SQL}, ${FINAL_TOTAL_SQL}
       FROM attendance a
       ${FINAL_JOIN_SQL}
       WHERE a.phone = ?1
       GROUP BY a.phone
       ON CONFLICT(phone) DO UPDATE SET mask = excluded.mask, total_count = excluded.total_count`,
    )
    .bind(phone);
}

function insertAllFinalStatement(db: D1Database): D1PreparedStatement {
  return db.prepare(
    `INSERT INTO "final" (phone, mask, total_count)
     SELECT a.phone, ${FINAL_MASK_SQL}, ${FINAL_TOTAL_SQL}
     FROM attendance a
     ${FINAL_JOIN_SQL}
     WHERE 1 = 1
     GROUP BY a.phone
     ON CONFLICT(phone) DO UPDATE SET mask = excluded.mask, total_count = excluded.total_count`,
  );
}

function upsertSourceStatement(db: D1Database, source: SourceMetadata): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO sources (kind, name, r2_key, size, uploaded_at, status)
       VALUES (?1, ?2, ?3, ?4, ?5, 'ready')
       ON CONFLICT(kind, name) DO UPDATE SET
         r2_key = excluded.r2_key,
         size = excluded.size,
         uploaded_at = excluded.uploaded_at,
         status = excluded.status`,
    )
    .bind(source.kind, source.name, source.r2_key, source.size, source.uploaded_at);
}

async function runAtomicBatch(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  if (statements.length === 0) return;
  const results = await db.batch(statements);
  const failed = results.find((result) => !result.success);
  if (failed) {
    throw new Error(failed.error || "D1 原子批处理失败");
  }
}
