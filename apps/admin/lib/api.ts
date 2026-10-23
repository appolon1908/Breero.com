import type {
  AccessAssignment,
  AccessCatalog,
  AccessRole,
  AdminUserDetail,
  AdminUserStatus,
  AdminUserSummary,
  EarningsSummary,
  EffectiveAccess,
  FinanceException,
  FinanceStatus,
  Page,
  PaymentRecord,
  PayoutBatchDetail,
  PayoutBatchSummary,
  PayoutCandidates,
  PayoutStatus,
  PostalCode,
  PostalCodeImportResult,
  PostalCodeImportRow,
  ProviderApplication,
  ProviderApplicationList,
  ProviderApplicationStatus,
  RefundRecord,
  ServiceZone,
  ServiceZoneCoverage,
  UserRole,
  Uuid,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string, readonly details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

export function ifMatch(version: number): string {
  return `"${version}"`;
}

export function newIdempotencyKey(prefix: string, random: () => string = () => crypto.randomUUID()): string {
  return `${prefix}-${random()}`;
}

export type AdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createAdminApi(portalRequest: AdminRequest) {
  async function request<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, ...rest } = init;
    const headers = new Headers(rest.headers);
    headers.set("Accept", "application/json");
    if (json !== undefined) headers.set("Content-Type", "application/json");
    try {
      const value = await portalRequest<T>(path, {
        ...rest,
        method: rest.method ?? "GET",
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
        cache: "no-store",
      });
      if (value !== undefined && (value === null || typeof value !== "object")) {
        throw new ApiError(200, "INVALID_RESPONSE", "The BREERO API returned an unreadable response");
      }
      return value;
    } catch (reason) {
      const problem = reason instanceof Error && "problem" in reason ? reason.problem : null;
      if (problem && typeof problem === "object" && "status" in problem && typeof problem.status === "number") {
        const details = "details" in problem && Array.isArray(problem.details)
          ? problem.details.filter((item): item is string => typeof item === "string") : [];
        const message = "message" in problem && typeof problem.message === "string" ? problem.message : "Request failed";
        throw new ApiError(
          problem.status,
          "code" in problem && typeof problem.code === "string" ? problem.code : `HTTP_${problem.status}`,
          details.length ? `${message} ${details.join("; ")}` : message,
          details,
        );
      }
      if (reason instanceof SyntaxError) throw new ApiError(200, "INVALID_RESPONSE", "The BREERO API returned an unreadable response");
      if (reason instanceof TypeError) throw new ApiError(0, "NETWORK_ERROR", "Unable to reach the BREERO API");
      throw reason;
    }
  }

  return {
    request,

    // users & access
    listUsers: (query: { q?: string; status?: AdminUserStatus; role?: UserRole; access_role?: AccessRole; page?: number; page_size?: number }) =>
      request<Page<AdminUserSummary>>(withQuery("/admin/users", query)),
    getUser: (id: Uuid) => request<AdminUserDetail>(`/admin/users/${id}`),
    getEffectiveAccess: (id: Uuid) => request<EffectiveAccess>(`/admin/users/${id}/effective-access`),
    replaceAccess: (id: Uuid, assignments: AccessAssignment[], reason: string) =>
      request<EffectiveAccess>(`/admin/users/${id}/access`, { method: "PUT", json: { assignments, reason } }),
    disableUser: (id: Uuid, reason: string) =>
      request<AdminUserDetail>(`/admin/users/${id}/disable`, { method: "POST", json: { reason } }),
    reactivateUser: (id: Uuid, reason: string) =>
      request<AdminUserDetail>(`/admin/users/${id}/reactivate`, { method: "POST", json: { reason } }),
    accessCatalog: () => request<AccessCatalog>("/auth/access/catalog"),

    // provider applications
    listApplications: (query: { status?: ProviderApplicationStatus; limit?: number; offset?: number }) =>
      request<ProviderApplicationList>(withQuery("/admin/provider-applications", query)),
    getApplication: (id: Uuid) => request<ProviderApplication>(`/admin/provider-applications/${id}`),
    decideApplication: (id: Uuid, decision: "approve" | "reject" | "request-information", reason: string) =>
      request<ProviderApplication>(`/admin/provider-applications/${id}/${decision}`, { method: "POST", json: { reason } }),

    // geography
    listZones: (query: { active?: boolean; state_code?: string; city?: string; postal_code?: string; page?: number; page_size?: number }) =>
      request<Page<ServiceZone>>(withQuery("/admin/service-zones", query)),
    getZone: (id: Uuid) => request<ServiceZone>(`/admin/service-zones/${id}`),
    zoneCoverage: (id: Uuid) => request<ServiceZoneCoverage>(`/admin/service-zones/${id}/coverage`),
    createZone: (payload: Record<string, unknown>) =>
      request<ServiceZone>("/admin/service-zones", { method: "POST", json: payload }),
    updateZone: (id: Uuid, version: number, payload: Record<string, unknown>) =>
      request<ServiceZone>(`/admin/service-zones/${id}`, { method: "PATCH", json: payload, headers: { "If-Match": ifMatch(version) } }),
    deactivateZone: (id: Uuid, version: number) =>
      request<void>(`/admin/service-zones/${id}`, { method: "DELETE", headers: { "If-Match": ifMatch(version) } }),
    listPostalCodes: (query: { service_area_id?: Uuid; postal_code?: string; state_code?: string; active?: boolean; page?: number; page_size?: number }) =>
      request<Page<PostalCode>>(withQuery("/admin/postal-codes", query)),
    createPostalCode: (payload: Record<string, unknown>) =>
      request<PostalCode>("/admin/postal-codes", { method: "POST", json: payload }),
    updatePostalCode: (id: Uuid, version: number, payload: Record<string, unknown>) =>
      request<PostalCode>(`/admin/postal-codes/${id}`, { method: "PATCH", json: payload, headers: { "If-Match": ifMatch(version) } }),
    deactivatePostalCode: (id: Uuid, version: number) =>
      request<void>(`/admin/postal-codes/${id}`, { method: "DELETE", headers: { "If-Match": ifMatch(version) } }),
    importPostalCodes: (serviceAreaId: Uuid, rows: PostalCodeImportRow[], idempotencyKey: string) =>
      request<PostalCodeImportResult>("/admin/postal-codes/import", {
        method: "POST",
        json: { service_area_id: serviceAreaId, rows },
        headers: { "Idempotency-Key": idempotencyKey },
      }),

    // finance reads
    financeStatus: () => request<FinanceStatus>("/finance/status"),
    earningsSummary: (vendorId?: Uuid) => request<EarningsSummary>(withQuery("/finance/earnings/summary", { vendor_id: vendorId })),
    financeExceptions: () => request<{ items: FinanceException[]; total: number }>("/finance/exceptions"),
    payoutCandidates: (currency: string, vendorId?: Uuid) =>
      request<PayoutCandidates>(withQuery("/finance/payout-candidates", { currency, vendor_id: vendorId })),
    listPayoutBatches: (query: { status?: PayoutStatus; currency?: string; page?: number; page_size?: number }) =>
      request<Page<PayoutBatchSummary>>(withQuery("/finance/payout-batches", query)),
    getPayoutBatch: (id: Uuid) => request<PayoutBatchDetail>(`/finance/payout-batches/${id}`),
    listPayments: (query: { status?: string; page?: number; page_size?: number }) =>
      request<Page<PaymentRecord>>(withQuery("/finance/payments", query)),
    listRefunds: (query: { status?: string; payment_id?: Uuid; page?: number; page_size?: number }) =>
      request<Page<RefundRecord>>(withQuery("/finance/refunds", query)),

    // payout commands (only routable while PAYOUT_ENABLED is true server-side)
    createPayoutBatch: (currency: string, vendorId?: Uuid) =>
      request<PayoutBatchSummary>("/finance/payout-batches", { method: "POST", json: { currency, vendor_id: vendorId ?? null } }),
    approvePayoutBatch: (id: Uuid) => request<PayoutBatchSummary>(`/finance/payout-batches/${id}/approve`, { method: "POST" }),
    submitPayoutBatch: (id: Uuid) => request<PayoutBatchSummary>(`/finance/payout-batches/${id}/submit`, { method: "POST" }),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;
