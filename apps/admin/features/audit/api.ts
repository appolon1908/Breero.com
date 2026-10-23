// Authenticated transport for the admin audit console.
// The portal uses HttpOnly browser-session cookies; JavaScript never reads tokens.

export class AuditApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

export function apiBase(value: string | undefined = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!value || !/^https:\/\//.test(value)) throw new AuditApiError("A secure API origin is required.", 0);
  return value.replace(/\/$/, "");
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Sign in again from the admin portal.",
  403: "Your account is not authorized to read audit records. This attempt was recorded.",
  404: "The audit record was not found.",
};

export async function auditGet<T>(path: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(`${apiBase()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "include",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string }; detail?: unknown };
    const message = STATUS_MESSAGES[response.status] ?? body.error?.message ?? `Request failed (${response.status}).`;
    throw new AuditApiError(message, response.status, body.error?.code);
  }
  return (await response.json()) as T;
}
