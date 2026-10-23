import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdministrationLayout from "../app/(administration)/layout";
import Page0 from "../app/(administration)/finance/page";
import Page1 from "../app/(administration)/finance/payments/page";
import Page2 from "../app/(administration)/finance/payouts/page";
import Page3 from "../app/(administration)/finance/payouts/[batchId]/page";
import Page4 from "../app/(administration)/geography/page";
import Page5 from "../app/(administration)/geography/postal-codes/page";
import Page6 from "../app/(administration)/geography/zones/[zoneId]/page";
import Page7 from "../app/(administration)/providers/page";
import Page8 from "../app/(administration)/providers/[applicationId]/page";
import Page9 from "../app/(administration)/users/page";
import Page10 from "../app/(administration)/users/[userId]/page";
import Page11 from "../app/(administration)/audit/page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ batchId: "batch-1", zoneId: "zone-1", userId: "user-1", applicationId: "application-1" }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("administration route group prerender", () => {
  it.each([
    ["/finance", Page0],
    ["/finance/payments", Page1],
    ["/finance/payouts", Page2],
    ["/finance/payouts/[batchId]", Page3],
    ["/geography", Page4],
    ["/geography/postal-codes", Page5],
    ["/geography/zones/[zoneId]", Page6],
    ["/providers", Page7],
    ["/providers/[applicationId]", Page8],
    ["/users", Page9],
    ["/users/[userId]", Page10],
    ["/audit", Page11]
  ] as const)("prerenders %s through the real shared session boundary", (_path, Page) => {
    const html = renderToStaticMarkup(<AdministrationLayout><Page /></AdministrationLayout>);
    expect(html).toContain("Loading secure workspace");
    expect(html).not.toContain("useAdmin must be used");
    expect(html).not.toContain('type="password"');
  });
});
