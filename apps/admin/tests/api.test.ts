import { describe, expect, it, vi } from "vitest";
import { readProblem } from "@breero/portal";
import { ApiError, createAdminApi, ifMatch, newIdempotencyKey, withQuery } from "../lib/api";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(response: Response | (() => Response)) {
  const calls: [string, RequestInit?][] = [];
  const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    calls.push([path, init]);
    const current = typeof response === "function" ? response() : response;
    if (!current.ok) {
      const problem = await readProblem(current);
      throw Object.assign(new Error(problem.message), { problem });
    }
    if (current.status === 204) return undefined as T;
    return current.headers.get("content-type")?.includes("application/json")
      ? await current.json() as T : await current.text() as T;
  };
  const api = createAdminApi(request);
  return { api, fetchImpl: { mock: { calls } } };
}

type FetchCall = [string, RequestInit & { headers: Headers }];

function lastCall(fetchImpl: { mock: { calls: unknown[][] } }): { url: string; init: FetchCall[1] } {
  const [url, init] = fetchImpl.mock.calls.at(-1) as unknown as FetchCall;
  return { url, init };
}

describe("shared request failures", () => {
  it.each([
    [409, { error: { code: "USER_ALREADY_DISABLED", message: "User is already disabled." } }, "USER_ALREADY_DISABLED", "User is already disabled."],
    [403, { detail: "Insufficient permissions" }, "HTTP_403", "Insufficient permissions"],
    [422, { detail: [{ loc: ["body", "reason"], msg: "String should have at least 3 characters" }] }, "VALIDATION_ERROR", "Some fields need attention. reason: String should have at least 3 characters"],
  ])("maps the real shared problem for status %s", async (status, body, code, message) => {
    const { api } = client(json(status as number, body));
    await expect(api.listUsers({})).rejects.toBeInstanceOf(ApiError);
    const retry = client(json(status as number, body));
    await expect(retry.api.listUsers({})).rejects.toMatchObject({ status, code, message });
  });

  it.each([401, 403])("does not retry or fall back to direct fetch for %s", async (status) => {
    const error = Object.assign(new Error("Denied"), { problem: { status, message: "Denied" } });
    const request = vi.fn<(path: string, init?: RequestInit) => Promise<never>>().mockRejectedValue(error);
    await expect(createAdminApi(request).financeStatus()).rejects.toMatchObject({ status });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Response("<html>proxy</html>"),
    new Response("{bad json", { headers: { "Content-Type": "application/json" } }),
  ])("rejects unreadable success bodies", async (response) => {
    await expect(client(response).api.financeStatus()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("preserves the shared offline mutation guard", async () => {
    const failure = new Error("You are offline. Changes are blocked until the connection returns.");
    const request = vi.fn<(path: string, init?: RequestInit) => Promise<never>>().mockRejectedValue(failure);
    await expect(createAdminApi(request).disableUser("u1", "review")).rejects.toBe(failure);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("helpers", () => {
  it("drops empty query values", () => {
    expect(withQuery("/admin/users", { q: "ann", status: undefined, role: "", page: 2, active: false })).toBe("/admin/users?q=ann&page=2&active=false");
    expect(withQuery("/x")).toBe("/x");
  });

  it("formats If-Match and idempotency keys the API accepts", () => {
    expect(ifMatch(7)).toBe('"7"');
    const key = newIdempotencyKey("postal-import", () => "0f8fad5b-d9cb-469f-a165-70867728950e");
    expect(key).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);
  });
});

describe("createAdminApi", () => {
  it("delegates relative paths to the shared BFF without browser bearer auth", async () => {
    const { api, fetchImpl } = client(json(200, { items: [], total: 0, page: 1, page_size: 25 }));
    await api.listUsers({ q: "a@b.co", status: "disabled", page: 1, page_size: 25 });
    const { url, init } = lastCall(fetchImpl);
    expect(url).toBe("/admin/users?q=a%40b.co&status=disabled&page=1&page_size=25");
    expect(init.headers.has("Authorization")).toBe(false);
    expect(init.cache).toBe("no-store");
  });

  it("posts lifecycle reasons as JSON", async () => {
    const { api, fetchImpl } = client(json(200, { id: "u1" }));
    await api.disableUser("u1", "fraud review");
    const { url, init } = lastCall(fetchImpl);
    expect(url).toMatch(/\/admin\/users\/u1\/disable$/);
    expect(init.method).toBe("POST");
    expect(init.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ reason: "fraud review" });
  });

  it("sends If-Match for versioned geography writes and handles 204", async () => {
    const { api, fetchImpl } = client(new Response(null, { status: 204 }));
    await expect(api.deactivateZone("z1", 4)).resolves.toBeUndefined();
    const { init } = lastCall(fetchImpl);
    expect(init.method).toBe("DELETE");
    expect(init.headers.get("If-Match")).toBe('"4"');
  });

  it("sends Idempotency-Key for postal imports", async () => {
    const { api, fetchImpl } = client(json(201, { id: "i1", status: "COMPLETED" }));
    await api.importPostalCodes("zone", [{ postal_code: "10001" }], "postal-import-abc12345");
    const { init } = lastCall(fetchImpl);
    expect(init.headers.get("Idempotency-Key")).toBe("postal-import-abc12345");
    expect(JSON.parse(String(init.body))).toEqual({ service_area_id: "zone", rows: [{ postal_code: "10001" }] });
  });

  it("targets the provider decision endpoints", async () => {
    const { api, fetchImpl } = client(json(200, { id: "a1" }));
    await api.decideApplication("a1", "request-information", "Need insurance");
    expect(lastCall(fetchImpl).url).toMatch(/\/admin\/provider-applications\/a1\/request-information$/);
  });

  it("throws ApiError on failure so screens can show the server message", async () => {
    const { api } = client(() => json(404, { detail: "Not Found" }));
    await expect(api.approvePayoutBatch("b1")).rejects.toMatchObject({ status: 404, message: "Not Found" });
  });
});
