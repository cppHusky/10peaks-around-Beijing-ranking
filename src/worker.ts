import { BRANCHES, PEAKS } from "./shared/peaks";
import { clearSessionCookie, createSessionCookie, isAdmin, requireAdmin } from "./worker/auth";
import { deleteAttendanceSource, deleteRawSource, getLeaderboard, getPeakActivities, getReadySource, listReadySources, publishAttendanceSource, publishRawSource, rebuildAllFinal } from "./worker/db";
import { handleErrors, HttpError, json, readJson, requireMethod, text } from "./worker/http";
import type { Env } from "./worker/types";
import { parseActivityWorkbook, parseAttendanceWorkbook } from "./worker/xlsx";

const ATTENDANCE_SOURCE_NAME = "attendance.xlsx";
const ATTENDANCE_DISPLAY_NAME = "十峰挑战赛报名时间表";
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleErrors(async () => {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
      return serveAsset(request, env);
    });
  },
};

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/leaderboard") {
    requireMethod(request, "GET");
    return json({ branches: BRANCHES, peaks: PEAKS, rows: await getLeaderboard(env.DB) });
  }

  if (url.pathname === "/api/leaderboard/peak-activities") {
    requireMethod(request, "GET");
    const serial = parseInt(url.searchParams.get("serial") ?? "", 10);
    const peak = parseInt(url.searchParams.get("peak") ?? "", 10);
    if (!Number.isFinite(serial) || !Number.isFinite(peak) || peak < 0 || peak >= 30) {
      throw new HttpError(400, "参数不合法");
    }
    return json({ activities: await getPeakActivities(env.DB, serial, 1 << peak) });
  }

  if (url.pathname === "/api/admin/login") {
    requireMethod(request, "POST");
    const { token } = await readJson<{ token?: string }>(request);
    const cookie = await createSessionCookie(request, env, token ?? "");
    return json({ ok: true }, { headers: { "set-cookie": cookie } });
  }

  if (url.pathname === "/api/admin/logout") {
    requireMethod(request, "POST");
    return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
  }

  if (url.pathname === "/api/admin/session") {
    requireMethod(request, "GET");
    return json({ authenticated: await isAdmin(request, env) });
  }

  await requireAdmin(request, env);

  if (url.pathname === "/api/admin/files") {
    if (request.method === "GET") return json(await listFiles(env));
    if (request.method === "DELETE") return deleteFile(request, env, url);
  }

  if (url.pathname === "/api/admin/download") {
    requireMethod(request, "GET");
    return downloadFile(env, url);
  }

  if (url.pathname === "/api/admin/upload/attendance") {
    requireMethod(request, "POST");
    return uploadAttendance(request, env);
  }

  if (url.pathname === "/api/admin/upload/activity") {
    requireMethod(request, "POST");
    return uploadActivity(request, env);
  }

  if (url.pathname === "/api/admin/rebuild") {
    requireMethod(request, "POST");
    await rebuildAllFinal(env.DB);
    return json({ ok: true });
  }

  throw new HttpError(404, "API 不存在");
}

async function uploadAttendance(request: Request, env: Env): Promise<Response> {
  const file = await readUploadedXlsx(request);
  const buffer = await file.arrayBuffer();
  const records = await parseAttendanceWorkbook(buffer);
  const r2Key = sourceObjectKey("attendance", sanitizeFilename(file.name || ATTENDANCE_SOURCE_NAME));

  await env.BUCKET.put(r2Key, buffer, {
    httpMetadata: { contentType: XLSX_CONTENT_TYPE },
  });

  try {
    const oldSource = await publishAttendanceSource(env.DB, {
      kind: "attendance",
      name: ATTENDANCE_SOURCE_NAME,
      r2_key: r2Key,
      size: buffer.byteLength,
      uploaded_at: new Date().toISOString(),
    }, records);
    await deleteObjectIfReplaced(env, oldSource?.r2_key, r2Key);
  } catch (error) {
    await deleteObjectBestEffort(env, r2Key);
    throw error;
  }

  return json({ ok: true, count: records.length, filename: file.name });
}

async function uploadActivity(request: Request, env: Env): Promise<Response> {
  const files = await readUploadedXlsxFiles(request);
  const uploads = [];
  const filenames = new Set<string>();

  for (const file of files) {
    const source = sanitizeFilename(file.name);
    if (filenames.has(source)) {
      throw new HttpError(400, `本次上传存在同名活动表：${source}`);
    }
    filenames.add(source);

    const buffer = await file.arrayBuffer();
    uploads.push({ source, buffer, r2Key: sourceObjectKey("activity", source), records: await parseActivityWorkbook(buffer, source) });
  }

  const results = [];
  for (const upload of uploads) {
    await env.BUCKET.put(upload.r2Key, upload.buffer, {
      httpMetadata: { contentType: XLSX_CONTENT_TYPE },
    });

    try {
      const published = await publishRawSource(env.DB, {
        kind: "activity",
        name: upload.source,
        r2_key: upload.r2Key,
        size: upload.buffer.byteLength,
        uploaded_at: new Date().toISOString(),
      }, upload.records);
      await deleteObjectIfReplaced(env, published.oldSource?.r2_key, upload.r2Key);
      results.push({ filename: upload.source, rows: upload.records.length, affected: published.affected.length });
    } catch (error) {
      await deleteObjectBestEffort(env, upload.r2Key);
      throw error;
    }
  }

  return json({ ok: true, files: results, count: results.length, rows: results.reduce((sum, result) => sum + result.rows, 0) });
}

async function deleteFile(request: Request, env: Env, url: URL): Promise<Response> {
  requireMethod(request, "DELETE");
  const type = url.searchParams.get("type");
  if (type === "attendance") {
    const oldSource = await deleteAttendanceSource(env.DB, ATTENDANCE_SOURCE_NAME);
    await deleteObjectBestEffort(env, oldSource?.r2_key);
    return json({ ok: true });
  }

  if (type === "activity") {
    const filename = requireFilename(url);
    const deleted = await deleteRawSource(env.DB, filename);
    await deleteObjectBestEffort(env, deleted.oldSource?.r2_key);
    return json({ ok: true, affected: deleted.affected.length });
  }

  throw new HttpError(400, "文件类型不正确");
}

async function downloadFile(env: Env, url: URL): Promise<Response> {
  const type = url.searchParams.get("type");
  const filename = type === "attendance" ? ATTENDANCE_SOURCE_NAME : requireFilename(url);
  const source = type === "attendance"
    ? await getReadySource(env.DB, "attendance", ATTENDANCE_SOURCE_NAME)
    : await getReadySource(env.DB, "activity", filename);
  if (!source) throw new HttpError(404, "文件不存在");

  const object = await env.BUCKET.get(source.r2_key);
  if (!object) throw new HttpError(404, "文件对象缺失，请重新上传");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", headers.get("content-type") || XLSX_CONTENT_TYPE);
  headers.set("content-disposition", contentDisposition(type === "attendance" ? `${ATTENDANCE_DISPLAY_NAME}.xlsx` : filename));
  return new Response(object.body, { headers });
}

async function listFiles(env: Env): Promise<unknown> {
  const sources = await listReadySources(env.DB);
  return {
    attendance: sources.attendance
      ? {
          name: ATTENDANCE_DISPLAY_NAME,
          key: sources.attendance.r2_key,
          size: sources.attendance.size,
          uploaded: sources.attendance.uploaded_at,
        }
      : null,
    activities: sources.activities.map((source) => ({
      name: source.name,
      key: source.r2_key,
      size: source.size,
      uploaded: source.uploaded_at,
    })),
  };
}

async function readUploadedXlsx(request: Request): Promise<File> {
  const [file] = await readUploadedXlsxFiles(request);
  return file;
}

async function readUploadedXlsxFiles(request: Request): Promise<File[]> {
  const form = await request.formData();
  const files = form.getAll("file").filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    throw new HttpError(400, "请上传 xlsx 文件");
  }

  for (const file of files) {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      throw new HttpError(400, `只支持 .xlsx 文件：${file.name}`);
    }
  }

  return files;
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.trim().replace(/[\\/\u0000-\u001f]/g, "_");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new HttpError(400, "文件名不合法");
  }
  return normalized;
}

function requireFilename(url: URL): string {
  const filename = url.searchParams.get("name");
  if (!filename) throw new HttpError(400, "缺少文件名");
  return sanitizeFilename(filename);
}

function sourceObjectKey(kind: "attendance" | "activity", filename: string): string {
  const prefix = kind === "attendance" ? "attendance" : "activities";
  return `${prefix}/${crypto.randomUUID()}/${filename}`;
}

async function deleteObjectIfReplaced(env: Env, oldKey: string | undefined, newKey: string): Promise<void> {
  if (oldKey && oldKey !== newKey) {
    await deleteObjectBestEffort(env, oldKey);
  }
}

async function deleteObjectBestEffort(env: Env, key: string | undefined): Promise<void> {
  if (!key) return;
  try {
    await env.BUCKET.delete(key);
  } catch (error) {
    console.error("R2 对象清理失败", key, error);
  }
}

function contentDisposition(filename: string): string {
  const asciiName = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function serveAsset(request: Request, env: Env): Promise<Response> {
  if (!env.ASSETS) return text("静态资源绑定 ASSETS 尚未配置", { status: 500 });
  return env.ASSETS.fetch(request);
}
