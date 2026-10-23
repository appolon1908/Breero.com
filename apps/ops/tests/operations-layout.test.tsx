import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import OperationsLayout from "../app/(operations)/layout";
import CapacityPage from "../app/(operations)/capacity/page";
import ExceptionsPage from "../app/(operations)/exceptions/page";
import IntegrationsPage from "../app/(operations)/integrations/page";
import JobPage from "../app/(operations)/jobs/[jobId]/page";
import QueuePage from "../app/(operations)/queue/page";
import ServiceAreasPage from "../app/(operations)/service-areas/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/exceptions",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ jobId: "job-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("operations route group prerender", () => {
  it.each([
    ["/capacity", CapacityPage],
    ["/exceptions", ExceptionsPage],
    ["/integrations", IntegrationsPage],
    ["/jobs/[jobId]", JobPage],
    ["/queue", QueuePage],
    ["/service-areas", ServiceAreasPage],
  ] as const)("prerenders %s through the real shared session loading boundary", (_path, Page) => {
    const html = renderToStaticMarkup(<OperationsLayout><Page /></OperationsLayout>);
    expect(html).toContain("Loading secure workspace");
    expect(html).not.toContain("useOps must be used");
    expect(html).not.toContain("type=\"password\"");
  });
});
