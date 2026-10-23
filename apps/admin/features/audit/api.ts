import { ApiError, type AdminRequest } from "../../lib/api";

export class AuditApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Sign in again from the admin portal.",
  403: "Your account is not authorized to read audit records. This attempt was recorded.",
  404: "The audit record was not found.",
};

export function createAuditGet(request: AdminRequest) {
  return async <T>(path: string): Promise<T> => {
    try {
      return await request<T>(path, { method: "GET" });
    } catch (reason) {
      if (reason instanceof ApiError) {
        throw new AuditApiError(STATUS_MESSAGES[reason.status] ?? reason.message, reason.status, reason.code);
      }
      throw new AuditApiError("Unable to load audit records.", 0);
    }
  };
}
