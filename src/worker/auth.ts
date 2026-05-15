import { HttpError } from "./http";
import type { Env } from "./types";

const COOKIE_NAME = "ranking_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

export async function createSessionCookie(request: Request, env: Env, token: string): Promise<string> {
  assertAdminToken(env);
  if (token !== env.ADMIN_TOKEN) {
    throw new HttpError(401, "管理员 token 不正确");
  }

  const expires = Date.now() + SESSION_TTL_MS;
  const signature = await sign(String(expires), env.ADMIN_TOKEN);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${expires}.${signature}; Path=/; Max-Age=${SESSION_TTL_MS / 1000}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export async function requireAdmin(request: Request, env: Env): Promise<void> {
  const ok = await isAdmin(request, env);
  if (!ok) {
    throw new HttpError(401, "需要管理员登录");
  }
}

export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  assertAdminToken(env);
  const cookie = request.headers.get("cookie") ?? "";
  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);

  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = await sign(expires, env.ADMIN_TOKEN!);
  return constantTimeEqual(signature, expected);
}

function assertAdminToken(env: Env): void {
  if (!env.ADMIN_TOKEN) {
    throw new HttpError(500, "缺少 ADMIN_TOKEN 环境变量");
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(lhs: string, rhs: string): boolean {
  if (lhs.length !== rhs.length) return false;
  let diff = 0;
  for (let index = 0; index < lhs.length; index++) {
    diff |= lhs.charCodeAt(index) ^ rhs.charCodeAt(index);
  }
  return diff === 0;
}
