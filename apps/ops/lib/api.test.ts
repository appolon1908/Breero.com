import { readProblem } from "@breero/portal";
import { describe, expect, it, vi } from "vitest";
import { OpsApiError, createOpsApi, type OpsRequest } from "./api";
import { DEFAULT_QUEUE_FILTERS } from "./queue-filters";

const JOB = "0b7c6f1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b";

type Call = { url: string; method: string; headers: Headers; body?: unknown };

function recorder(respond: (call: Call) => Response) {
  const calls: Call[] = [];
  const request: OpsRequest = async <T,>(input: string, init?: RequestInit): Promise<T> => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const response = respond(call);
    if (!response.ok) {
      const problem = await readProblem(response);
      throw Object.assign(new Error(problem.message), { problem });
    }
    if (response.status === 204) return undefined as T;
    return response.headers.get("content-type")?.includes("application/json")
      ? await response.json() as T : await response.text() as T;
  };
  return { calls, request };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("ops api client", () => {
  it("delegates control-center projections to the shared BFF without browser bearer auth", async () => {
    const { calls, request } = recorder(() => json({ generated_at: "2026-09-25T12:00:00Z" }));
    const api = createOpsApi(request);
    await api.dashboard();
    await api.queue({ ...DEFAULT_QUEUE_FILTERS, statuses: ["CREATED"] });
    await api.exceptions("CRITICAL");
    await api.capacity("2026-09-25", true);
    await api.serviceAreas();
    await api.integrationFailures();
    await api.jobDetail(JOB);
    await api.candidates(JOB);
    expect(calls.map((call) => call.url)).toEqual([
      "/operations/control-center/summary",
      "/operations/control-center/queue?status=CREATED&limit=50&offset=0",
      "/operations/control-center/exceptions?severity=CRITICAL",
      "/operations/control-center/capacity?date=2026-09-25&include_inactive=true",
      "/operations/control-center/service-areas",
      "/operations/control-center/integration-failures",
      `/operations/control-center/jobs/${JOB}`,
      `/operations/control-center/jobs/${JOB}/candidates`,
    ]);
    for (const call of calls) {
      expect(call.method).toBe("GET");
      expect(call.headers.has("Authorization")).toBe(false);
      expect(call.url).toMatch(/^\/(?!\/)/);
      expect(call.headers.has("Content-Type")).toBe(false);
    }
  });

  it("sends mutations to the canonical command endpoints", async () => {
    const { calls, request } = recorder(() => json({}));
    const api = createOpsApi(request);
    await api.match(JOB);
    await api.assign(JOB, { vendor_id: "v", worker_id: "w", reason: "closest" });
    await api.reassign(JOB, { vendor_id: "v", worker_id: "w2", reason: "rebalance", expected_version: 4 });
    await api.transition(JOB, "EN_ROUTE", "dispatched by phone");
    await api.reviewWorkRequest("wr-1", false);
    expect(calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ["POST", `/operations/jobs/${JOB}/match`, undefined],
      ["POST", `/operations/jobs/${JOB}/assign`, { vendor_id: "v", worker_id: "w", reason: "closest" }],
      ["POST", `/operations/jobs/${JOB}/reassign`, { vendor_id: "v", worker_id: "w2", reason: "rebalance", expected_version: 4 }],
      ["POST", `/jobs/${JOB}/transition`, { status: "EN_ROUTE", reason: "dispatched by phone" }],
      ["POST", "/jobs/work-requests/wr-1/review", { approve: false }],
    ]);
    expect(calls[1].headers.get("Content-Type")).toBe("application/json");
  });

  it("encodes path identifiers", async () => {
    const { calls, request } = recorder(() => json({}));
    await createOpsApi(request).jobDetail("../admin");
    expect(calls[0].url).toBe(`/operations/control-center/jobs/..%2Fadmin`);
  });

  it.each([
    [json({ detail: "Job has changed since it was reviewed; reload and retry" }, 409), "Job has changed since it was reviewed; reload and retry", undefined],
    [json({ error: { code: "PROVIDER_CAPACITY_UNAVAILABLE", message: "Provider capacity is no longer available" } }, 409), "Provider capacity is no longer available", "PROVIDER_CAPACITY_UNAVAILABLE"],
    [json({ detail: [{ msg: "Field required" }, { msg: "Input should be greater than 0" }] }, 422), "Some fields need attention. Field required; Input should be greater than 0", "VALIDATION_ERROR"],
    [new Response("<html>", { status: 502 }), "Request failed (502)", undefined],
    [new Response("null", { status: 500 }), "Request failed (500)", undefined],
  ])("surfaces the server's error message (%#)", async (response, message, code) => {
    const { request } = recorder(() => response);
    const failure = await createOpsApi(request).reassign(JOB, { vendor_id: "v", worker_id: "w", reason: "r", expected_version: 1 }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(OpsApiError);
    expect((failure as OpsApiError).message).toBe(message);
    expect((failure as OpsApiError).code).toBe(code);
  });

  it.each([401, 403])("propagates denied BFF requests (%s) without retrying", async (status) => {
    const request = vi.fn<(path: string, init?: RequestInit) => Promise<never>>().mockRejectedValue(
      Object.assign(new Error("Access denied"), { problem: { status, message: "Access denied" } }),
    );
    await expect(createOpsApi(request).dashboard()).rejects.toMatchObject({ status, message: "Access denied" });
    expect(request).toHaveBeenCalledOnce();
  });

  it("reports network failures without leaking internals", async () => {
    const request = vi.fn<(path: string, init?: RequestInit) => Promise<never>>().mockRejectedValue(
      new TypeError("getaddrinfo ENOTFOUND internal-host"),
    );
    await expect(createOpsApi(request).dashboard()).rejects.toMatchObject({ status: 0, message: "Unable to reach the BREERO API" });
  });

  it("preserves the shared transport offline guard and never falls back to fetch", async () => {
    const offline = new Error("You are offline. Changes are blocked until the connection returns.");
    const request = vi.fn<(path: string, init?: RequestInit) => Promise<never>>().mockRejectedValue(offline);
    const fetch = vi.spyOn(globalThis, "fetch");
    try {
      await expect(createOpsApi(request).match(JOB)).rejects.toBe(offline);
      expect(request).toHaveBeenCalledOnce();
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
    }
  });

  it.each([
    new Response("<html>proxy</html>", { status: 200 }),
    new Response("{", { status: 200, headers: { "Content-Type": "application/json" } }),
  ])("rejects the shared transport's unreadable success result (%#)", async (response) => {
    const { request } = recorder(() => response);
    await expect(createOpsApi(request).dashboard()).rejects.toMatchObject({ status: 200, message: "The BREERO API returned an unreadable response" });
  });

  it("retains field guidance from the real shared 422 problem envelope", async () => {
    const { request } = recorder(() => json({
      detail: [{ loc: ["body", "expected_version"], msg: "Input should be greater than 0" }],
    }, 422));
    await expect(createOpsApi(request).reassign(JOB, {
      vendor_id: "v", worker_id: "w", reason: "reviewed", expected_version: 0,
    })).rejects.toMatchObject({
      status: 422, code: "VALIDATION_ERROR",
      message: "Some fields need attention. expected_version: Input should be greater than 0",
      details: ["expected_version: Input should be greater than 0"],
    });
  });
});

describe("dispatch journey through the client", () => {
  it("matches, assigns, reassigns with the reviewed version, and reads back server state", async () => {
    // Minimal stand-in for the API that enforces the same version precondition.
    const state = { status: "CREATED", version: 1, worker: null as string | null };
    const { calls, request } = recorder((call) => {
      const path = call.url;
      if (path.endsWith("/match")) { state.status = "OFFERED"; state.version += 2; return json([{ id: "offer-1" }]); }
      if (path.endsWith("/assign")) { state.status = "ASSIGNED"; state.version += 1; state.worker = (call.body as { worker_id: string }).worker_id; return json({ id: "a1" }, 201); }
      if (path.endsWith("/reassign")) {
        const body = call.body as { worker_id: string; expected_version: number };
        if (body.expected_version !== state.version) return json({ detail: "Job has changed since it was reviewed; reload and retry" }, 409);
        state.version += 1; state.worker = body.worker_id;
        return json({ assignment: { id: "a2" }, released_assignment_id: "a1", job_id: JOB, job_status: state.status, job_version: state.version });
      }
      return json({ job: { status: state.status, version: state.version, worker: state.worker && { id: state.worker } } });
    });
    const api = createOpsApi(request);

    expect(await api.match(JOB)).toHaveLength(1);
    await api.assign(JOB, { vendor_id: "v", worker_id: "w1", reason: "closest" });
    const before = await api.jobDetail(JOB);
    expect(before.job.version).toBe(4);

    const result = await api.reassign(JOB, { vendor_id: "v", worker_id: "w2", reason: "rebalance", expected_version: before.job.version });
    expect(result.job_version).toBe(5);
    await expect(
      api.reassign(JOB, { vendor_id: "v", worker_id: "w1", reason: "stale screen", expected_version: before.job.version }),
    ).rejects.toMatchObject({ status: 409 });

    const after = await api.jobDetail(JOB);
    expect(after.job.worker?.id).toBe("w2");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(4);
  });
});
