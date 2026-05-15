export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function text(data: string, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "text/plain; charset=utf-8");
  return new Response(data, { ...init, headers });
}

export async function handleErrors(callback: () => Promise<Response>): Promise<Response> {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.message }, { status: error.status });
    }

    console.error(error);
    const message = error instanceof Error ? error.message : "未知错误";
    return json({ error: message }, { status: 500 });
  }
}

export function requireMethod(request: Request, method: string): void {
  if (request.method !== method) {
    throw new HttpError(405, `只支持 ${method} 请求`);
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "请求体不是有效的 JSON");
  }
}
