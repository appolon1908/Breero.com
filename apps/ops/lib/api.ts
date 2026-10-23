import { toQueueSearchParams, type QueueFilterState } from "./queue-filters";
import type {
  AssignmentCandidates,
  AssignmentRead,
  CapacityBoard,
  ExceptionQueue,
  IntegrationFailurePage,
  JobControlDetail,
  JobRead,
  JobStatus,
  OfferRead,
  OperationsDashboard,
  QueuePage,
  ReassignmentRead,
  RiskSeverity,
  ServiceAreaProjection,
  WorkRequest,
} from "./types";

export class OpsApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details: string[] = []) {
    super(message);
    this.name = "OpsApiError";
  }
}

export type OpsRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

const CONTROL = "/operations/control-center";
const segment = (value: string) => encodeURIComponent(value);

export function createOpsApi(portalRequest: OpsRequest) {
  async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    try {
      const value = await portalRequest<T>(path, {
        method: init.method ?? "GET",
        headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (value !== undefined && (value === null || typeof value !== "object")) {
        throw new OpsApiError("The BREERO API returned an unreadable response", 200);
      }
      return value;
    } catch (reason) {
      const problem = reason instanceof Error && "problem" in reason ? reason.problem : null;
      if (problem && typeof problem === "object" && "status" in problem && typeof problem.status === "number") {
        const details = "details" in problem && Array.isArray(problem.details)
          ? problem.details.filter((item): item is string => typeof item === "string") : [];
        const message = "message" in problem && typeof problem.message === "string" ? problem.message : "Request failed";
        throw new OpsApiError(
          details.length ? `${message} ${details.join("; ")}` : message,
          problem.status,
          "code" in problem && typeof problem.code === "string" ? problem.code : undefined,
          details,
        );
      }
      if (reason instanceof SyntaxError) throw new OpsApiError("The BREERO API returned an unreadable response", 200);
      if (reason instanceof TypeError) throw new OpsApiError("Unable to reach the BREERO API", 0);
      throw reason;
    }
  }

  return {
    dashboard: () => request<OperationsDashboard>(`${CONTROL}/summary`),
    queue: (filters: QueueFilterState) => request<QueuePage>(`${CONTROL}/queue?${toQueueSearchParams(filters)}`),
    exceptions: (severity?: RiskSeverity) =>
      request<ExceptionQueue>(`${CONTROL}/exceptions${severity ? `?severity=${severity}` : ""}`),
    capacity: (date?: string, includeInactive = false) => {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (includeInactive) params.set("include_inactive", "true");
      const query = params.toString();
      return request<CapacityBoard>(`${CONTROL}/capacity${query ? `?${query}` : ""}`);
    },
    serviceAreas: () => request<ServiceAreaProjection>(`${CONTROL}/service-areas`),
    integrationFailures: () => request<IntegrationFailurePage>(`${CONTROL}/integration-failures`),
    jobDetail: (jobId: string) => request<JobControlDetail>(`${CONTROL}/jobs/${segment(jobId)}`),
    candidates: (jobId: string) => request<AssignmentCandidates>(`${CONTROL}/jobs/${segment(jobId)}/candidates`),
    match: (jobId: string) => request<OfferRead[]>(`/operations/jobs/${segment(jobId)}/match`, { method: "POST" }),
    assign: (jobId: string, body: { vendor_id: string; worker_id: string; reason: string }) =>
      request<AssignmentRead>(`/operations/jobs/${segment(jobId)}/assign`, { method: "POST", body }),
    reassign: (jobId: string, body: { vendor_id: string; worker_id: string; reason: string; expected_version: number }) =>
      request<ReassignmentRead>(`/operations/jobs/${segment(jobId)}/reassign`, { method: "POST", body }),
    transition: (jobId: string, status: JobStatus, reason: string) =>
      request<JobRead>(`/jobs/${segment(jobId)}/transition`, { method: "POST", body: { status, reason } }),
    reviewWorkRequest: (requestId: string, approve: boolean) =>
      request<WorkRequest>(`/jobs/work-requests/${segment(requestId)}/review`, { method: "POST", body: { approve } }),
  };
}

export type OpsApi = ReturnType<typeof createOpsApi>;
