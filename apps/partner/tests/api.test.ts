import { describe, expect, it, vi } from "vitest";

import { ApiError, PartnerApi, type PartnerRequest } from "../lib/api";

type Call = { path: string; init: RequestInit };

function recorder(result: unknown = { items: [], total: 0 }) {
  const calls: Call[] = [];
  const request: PartnerRequest = async <T,>(path: string, init: RequestInit = {}) => {
    calls.push({ path, init });
    return result as T;
  };
  return { calls, request };
}

const header = (call: Call, name: string) => new Headers(call.init.headers).get(name);

describe("PartnerApi authenticated BFF transport", () => {
  it("uses provider-scoped paths without exposing tokens or vendor identifiers", async () => {
    const { calls, request } = recorder();
    const api = new PartnerApi(request);
    await api.workers();
    await api.addRule({ weekday: 0, start_time: "08:00", end_time: "12:00", timezone: "America/Chicago" });
    await api.jobs();
    await api.offers("PENDING");
    await api.decideOffer("offer-1", true, "worker-1");

    expect(calls.map((call) => call.path)).toEqual([
      "/provider/workers",
      "/provider/availability/rules",
      "/provider/jobs",
      "/provider/offers?status=PENDING",
      "/provider/offers/offer-1/decision",
    ]);
    for (const call of calls) {
      expect(header(call, "Authorization")).toBeNull();
      expect(call.path).not.toMatch(/vendor|https?:/i);
      expect(String(call.init.body ?? "")).not.toMatch(/vendor/i);
    }
    expect(JSON.parse(String(calls[4].init.body))).toEqual({ accept: true, worker_id: "worker-1" });
  });

  it("preserves If-Match and empty mutation responses through the BFF", async () => {
    const { calls, request } = recorder(null);
    const emptyRequest: PartnerRequest = async <T,>(path: string, init?: RequestInit) => {
      await request(path, init);
      return undefined as T;
    };
    const api = new PartnerApi(emptyRequest);
    await expect(api.deleteRule("rule-1", 3)).resolves.toBeUndefined();
    await api.submitQualification("q-1", 7);
    await api.saveOnboarding({ capacity: { daily_jobs: 2 } }, 12);
    await api.removeService("ps-1", 2);
    expect(calls.map((call) => [call.init.method, header(call, "If-Match")])).toEqual([
      ["DELETE", '"3"'], ["POST", '"7"'], ["PATCH", '"12"'], ["DELETE", '"2"'],
    ]);
    expect(calls[2].init.body).toBe(JSON.stringify({ capacity: { daily_jobs: 2 } }));
  });

  it("encodes path segments", async () => {
    const { calls, request } = recorder();
    await new PartnerApi(request).updateQualification("../../admin", { title: "x" }, 1);
    expect(calls[0].path).toBe("/provider/qualifications/..%2F..%2Fadmin");
  });

  it.each([401, 403])("propagates a denied BFF request (%s) without retrying", async (status) => {
    const request = vi.fn<PartnerRequest>().mockRejectedValue(Object.assign(
      new Error("Access denied"), { problem: { status, message: "Access denied" } },
    ));
    const onUnauthorized = vi.fn();
    await expect(new PartnerApi(request, { onUnauthorized }).profile()).rejects.toMatchObject({ status });
    expect(request).toHaveBeenCalledOnce();
    expect(onUnauthorized).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });

  it("preserves version conflicts from the BFF session transport", async () => {
    const request = vi.fn<PartnerRequest>().mockRejectedValue(Object.assign(
      new Error("This record changed."),
      { problem: { status: 409, code: "VERSION_CONFLICT", message: "This record changed." } },
    ));
    await expect(new PartnerApi(request).profile()).rejects.toMatchObject({
      status: 409, code: "VERSION_CONFLICT", isVersionConflict: true,
    });
  });

  it.each(["VALIDATION_ERROR", "ONBOARDING_INCOMPLETE"])("preserves actionable %s details", async (code) => {
    const request = vi.fn<PartnerRequest>().mockRejectedValue(Object.assign(
      new Error("Some fields need attention."),
      { problem: { status: 422, code, details: ["phone: Invalid phone number"] } },
    ));
    await expect(new PartnerApi(request).profile()).rejects.toMatchObject({
      status: 422, code, details: ["phone: Invalid phone number"],
    });
  });

  it("keeps unexpected transport failures intact", async () => {
    const error = new Error("Network unavailable");
    const request = vi.fn<PartnerRequest>().mockRejectedValue(error);
    await expect(new PartnerApi(request).profile()).rejects.toBe(error);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
