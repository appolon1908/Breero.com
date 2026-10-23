/**
 * Partner-portal transport. Every provider route derives the provider organization
 * from the authenticated session; no method here accepts or sends a vendor identifier.
 */
import type {
  AvailabilityPreview,
  AvailabilityRule,
  AvailabilityRuleInput,
  AvailabilitySnapshot,
  BlackoutInput,
  BlackoutPeriod,
  CatalogService,
  CatalogSkill,
  OfferStatus,
  OnboardingChecklist,
  OnboardingPatch,
  ProfessionalLead,
  ProviderApplication,
  ProviderJob,
  ProviderOffer,
  ProviderProfile,
  ProviderProfilePatch,
  ProviderService,
  ProviderSkill,
  ProviderWorker,
  ProviderWorkerInput,
  Qualification,
  QualificationInput,
  QualificationList,
} from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details: string[];

  constructor(status: number, message: string, code?: string, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isVersionConflict(): boolean {
    return this.status === 409 && this.code === "VERSION_CONFLICT";
  }
}

export type PartnerRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const ifMatch = (version: number) => ({ "If-Match": `"${version}"` });

export class PartnerApi {
  private readonly portalRequest: PartnerRequest;
  private readonly onUnauthorized?: () => void;

  constructor(request: PartnerRequest, options: { onUnauthorized?: () => void } = {}) {
    this.portalRequest = request;
    this.onUnauthorized = options.onUnauthorized;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    try {
      return await this.portalRequest<T>(path, init);
    } catch (reason) {
      const problem = reason instanceof Error && "problem" in reason ? reason.problem : null;
      if (isRecord(problem) && typeof problem.status === "number") {
        if (problem.status === 401) this.onUnauthorized?.();
        throw new ApiError(
          problem.status,
          typeof problem.message === "string" ? problem.message : reason instanceof Error ? reason.message : "Request failed",
          typeof problem.code === "string" ? problem.code : undefined,
          Array.isArray(problem.details) ? problem.details.filter((item): item is string => typeof item === "string") : [],
        );
      }
      throw reason;
    }
  }

  private send<T>(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  // Company profile and onboarding
  profile() { return this.request<ProviderProfile>("/provider/profile"); }
  updateProfile(patch: ProviderProfilePatch) { return this.send<ProviderProfile>("PATCH", "/provider/profile", patch); }
  onboarding() { return this.request<ProviderApplication>("/provider/onboarding"); }
  onboardingChecklist() { return this.request<OnboardingChecklist>("/provider/onboarding/checklist"); }
  saveOnboarding(patch: OnboardingPatch, version: number) {
    return this.send<ProviderApplication>("PATCH", "/provider/onboarding", patch, ifMatch(version));
  }
  submitOnboarding(version: number) {
    return this.send<ProviderApplication>("POST", "/provider/onboarding/submit", undefined, ifMatch(version));
  }

  // Catalog selections
  catalogServices() { return this.request<CatalogService[]>("/services"); }
  skillCatalog() { return this.request<{ items: CatalogSkill[]; total: number }>("/provider/skill-catalog"); }
  services(includeInactive = false) {
    return this.request<{ items: ProviderService[]; total: number }>(`/provider/services?include_inactive=${includeInactive}`);
  }
  addService(serviceId: string, displayOrder = 0) {
    return this.send<ProviderService>("POST", "/provider/services", { service_id: serviceId, display_order: displayOrder });
  }
  updateService(id: string, patch: { active?: boolean; display_order?: number }, version: number) {
    return this.send<ProviderService>("PATCH", `/provider/services/${encodeURIComponent(id)}`, patch, ifMatch(version));
  }
  removeService(id: string, version: number) {
    return this.send<void>("DELETE", `/provider/services/${encodeURIComponent(id)}`, undefined, ifMatch(version));
  }
  skills(workerId?: string) {
    const query = workerId ? `?worker_id=${encodeURIComponent(workerId)}` : "";
    return this.request<{ items: ProviderSkill[]; total: number }>(`/provider/skills${query}`);
  }
  addSkill(skillId: string, workerId?: string) {
    return this.send<ProviderSkill>("POST", "/provider/skills", workerId ? { skill_id: skillId, worker_id: workerId } : { skill_id: skillId });
  }
  removeSkill(id: string, version: number) {
    return this.send<void>("DELETE", `/provider/skills/${encodeURIComponent(id)}`, undefined, ifMatch(version));
  }

  // Team
  workers() { return this.request<{ items: ProviderWorker[]; total: number }>("/provider/workers"); }
  addWorker(input: ProviderWorkerInput) { return this.send<ProviderWorker>("POST", "/provider/workers", input); }

  // Availability
  availability() { return this.request<AvailabilitySnapshot>("/provider/availability"); }
  availabilityPreview(startsAt: string, endsAt: string) {
    const query = new URLSearchParams({ starts_at: startsAt, ends_at: endsAt });
    return this.request<AvailabilityPreview>(`/provider/availability/preview?${query.toString()}`);
  }
  addRule(input: AvailabilityRuleInput) { return this.send<AvailabilityRule>("POST", "/provider/availability/rules", input); }
  updateRule(id: string, patch: Partial<Omit<AvailabilityRuleInput, "worker_id">>, version: number) {
    return this.send<AvailabilityRule>("PATCH", `/provider/availability/rules/${encodeURIComponent(id)}`, patch, ifMatch(version));
  }
  deleteRule(id: string, version: number) {
    return this.send<void>("DELETE", `/provider/availability/rules/${encodeURIComponent(id)}`, undefined, ifMatch(version));
  }
  addBlackout(input: BlackoutInput) { return this.send<BlackoutPeriod>("POST", "/provider/availability/blackouts", input); }
  deleteBlackout(id: string, version: number) {
    return this.send<void>("DELETE", `/provider/availability/blackouts/${encodeURIComponent(id)}`, undefined, ifMatch(version));
  }

  // Qualifications (metadata only; binary evidence upload is refused by the API)
  qualifications() { return this.request<QualificationList>("/provider/qualifications"); }
  addQualification(input: QualificationInput) { return this.send<Qualification>("POST", "/provider/qualifications", input); }
  updateQualification(id: string, patch: Partial<Omit<QualificationInput, "worker_id" | "qualification_type">>, version: number) {
    return this.send<Qualification>("PATCH", `/provider/qualifications/${encodeURIComponent(id)}`, patch, ifMatch(version));
  }
  submitQualification(id: string, version: number) {
    return this.send<Qualification>("POST", `/provider/qualifications/${encodeURIComponent(id)}/submit`, undefined, ifMatch(version));
  }
  withdrawQualification(id: string, version: number) {
    return this.send<void>("DELETE", `/provider/qualifications/${encodeURIComponent(id)}`, undefined, ifMatch(version));
  }

  // Jobs and offers
  jobs() { return this.request<{ items: ProviderJob[]; total: number }>("/provider/jobs"); }
  offers(status?: OfferStatus) {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<{ items: ProviderOffer[]; total: number }>(`/provider/offers${query}`);
  }
  /** Read-only; the route is mounted only when paid leads are enabled (404 otherwise). */
  leads() { return this.request<ProfessionalLead[]>("/provider/leads"); }
  decideOffer(id: string, accept: boolean, workerId?: string) {
    return this.send<ProviderOffer>(
      "POST",
      `/provider/offers/${encodeURIComponent(id)}/decision`,
      workerId ? { accept, worker_id: workerId } : { accept },
    );
  }
}
