export type D1Result<T = unknown> = {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: unknown;
};

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
};

export type D1Database = {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1Result>;
};

export type R2Object = {
  key: string;
  size: number;
  uploaded: Date;
};

export type R2ObjectBody = R2Object & {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata(headers: Headers): void;
};

export type R2Bucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ objects: R2Object[] }>;
};

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  ADMIN_TOKEN?: string;
};
