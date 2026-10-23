import { afterEach, describe, expect, it, vi } from "vitest";

import { AuditApiError, auditGet } from "./api";
import { AuditFilterError, buildSearchParams, defaultFilters, detailPath, formatMetadataValue, listPath, toLocalInput, tracePath } from "./query";
import type { AuditFilters } from "./types";

const NOW = new Date("2026-09-25T12:00:00Z");

function filters(overrides: Partial<AuditFilters> = {}): AuditFilters {
  return { ...defaultFilters(NOW), ...overrides };
}

describe("audit query building", () => {
  it("always sends an explicit, offset-bearing window and page size", () => {
    const params = buildSearchParams(filters());
    expect(params.get("occurred_from")).toMatch(/Z$/);
    expect(params.get("occurred_to")).toMatch(/Z$/);
    expect(params.get("limit")).toBe("50");
    expect([...params.keys()].sort()).toEqual(["limit", "occurred_from", "occurred_to"]);
  });

  it("maps every filter to the API contract", () => {
    const id = "0b6f3c1e-8a1d-4f59-9d2b-6f7f3a1d2c4e";
    const params = buildSearchParams(filters({
      actorId: id, action: "payout.", actionIsPrefix: true, resourceType: "payout_batch", resourceId: id,
      result: "denied", category: "access_denied", correlationId: "corr-1", vendorId: id, limit: 25,
    }), "CURSOR");
    expect(Object.fromEntries(params)).toMatchObject({
      actor_id: id, action_prefix: "payout.", resource_type: "payout_batch", resource_id: id,
      result: "denied", category: "access_denied", correlation_id: "corr-1", vendor_id: id, limit: "25", cursor: "CURSOR",
    });
    expect(params.has("action")).toBe(false);
  });

  it("rejects out-of-contract input before calling the API", () => {
    expect(() => buildSearchParams(filters({ actorId: "not-a-uuid" }))).toThrow(AuditFilterError);
    expect(() => buildSearchParams(filters({ action: "DROP TABLE" }))).toThrow(AuditFilterError);
    expect(() => buildSearchParams(filters({ correlationId: "bad id" }))).toThrow(AuditFilterError);
    expect(() => buildSearchParams(filters({ limit: 101 }))).toThrow(AuditFilterError);
    expect(() => buildSearchParams(filters({ occurredFrom: filters().occurredTo }))).toThrow(AuditFilterError);
    const tooOld = toLocalInput(new Date(NOW.getTime() - 400 * 86_400_000));
    expect(() => buildSearchParams(filters({ occurredFrom: tooOld }))).toThrow(/366 days/);
  });

  it("routes security view and builds safe detail and trace paths", () => {
    expect(listPath(filters({ view: "security" }))).toMatch(/^\/admin\/audit\/security-events\?/);
    expect(listPath(filters())).toMatch(/^\/admin\/audit\/events\?/);
    expect(() => detailPath("../../users")).toThrow(AuditFilterError);
    expect(() => tracePath("a/b")).toThrow(AuditFilterError);
    expect(tracePath("corr:1.2")).toBe("/admin/audit/correlations/corr%3A1.2");
  });

  it("formats metadata values without object serialization", () => {
    expect(formatMetadataValue(null)).toBe("—");
    expect(formatMetadataValue(["admin", "support"])).toBe("admin, support");
    expect(formatMetadataValue(false)).toBe("false");
  });
});

describe("audit transport", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses the browser session when checking audit access", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ categories: [] })));
    vi.stubGlobal("fetch", fetcher);

    await auditGet("/admin/audit/catalog");

    expect(fetcher).toHaveBeenCalledWith("https://api.example.test/api/v1/admin/audit/catalog", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "include",
    });
  });

  it("requires an https API origin and sends cookies without a bearer token", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1/");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await auditGet("/admin/audit/catalog", fetcher);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/v1/admin/audit/catalog");
    expect(init?.credentials).toBe("include");
    expect(init?.cache).toBe("no-store");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://insecure.example.test");
    await expect(auditGet("/x", fetcher)).rejects.toThrow(/secure API origin/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403])("rejects a denied browser session with status %s without leaking server details", async (status) => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ error: { code: "ACCESS_DENIED", message: "private-server-detail" } }),
      { status },
    ));
    const failure = auditGet("/admin/audit/catalog", fetcher);
    await expect(failure).rejects.toBeInstanceOf(AuditApiError);
    await expect(failure).rejects.toMatchObject({ status, code: "ACCESS_DENIED" });
    await expect(failure).rejects.not.toThrow(/private-server-detail/);
    await expect(failure).rejects.toThrow(status === 401 ? /session has expired/ : /not authorized/);
  });
});
