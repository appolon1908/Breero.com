import { PortalDataPage, type PortalDataSection } from "@breero/portal";
import { portalRuntime } from "../portal.config";

const sections: readonly PortalDataSection[] = [
  { label: "Dispatch", path: "/operations/control-center/queue", description: "Awaiting assignment, reassignment, and upcoming work queues." },
  { label: "Bookings", path: "/admin/bookings", description: "Authorized booking operations and service-local windows." },
  { label: "Providers", path: "/admin/providers", description: "Provider records available to operations for matching and approval workflows." },
  { label: "Provider applications", path: "/admin/provider-applications", description: "Pending and under-review provider onboarding applications." },
  { label: "Audit log", path: "/admin/audit-events", description: "Immutable dispatch and administration history." },
  { label: "Integration failures", path: "/operations/control-center/integration-failures", description: "Delivery failures available to operations for investigation." },
  { label: "Delivery status", path: "/portal/operations/overview", description: "Outbox delivery counts and effective capabilities available to operations." },
  { label: "Operations status", path: "/portal/operations/overview", description: "Current intake, booking, job, provider, and delivery status counts." }
];

export default function Page() {
  return <PortalDataPage config={portalRuntime} sections={sections} />;
}
