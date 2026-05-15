CREATE TABLE IF NOT EXISTS attendance (
  serial INTEGER PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  attend_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw (
  source TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  phone TEXT NOT NULL,
  mask INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, phone)
);

CREATE INDEX IF NOT EXISTS raw_phone_end_idx ON raw (phone, end_date);
CREATE INDEX IF NOT EXISTS raw_source_idx ON raw (source);

CREATE TABLE IF NOT EXISTS "final" (
  phone TEXT PRIMARY KEY,
  mask INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (phone) REFERENCES attendance(phone) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS final_total_idx ON "final" (total_count DESC);

CREATE TABLE IF NOT EXISTS sources (
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  uploaded_at TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (kind, name)
);

CREATE INDEX IF NOT EXISTS sources_status_idx ON sources (kind, status, name);
