import { describe, expect, it } from "vitest";

import { isAllowedPortalRequest } from "@breero/portal/server";
import { portalRuntime } from "../portal.config";

describe("operations BFF read routes", () => {
  it.each(["/admin/bookings", "/admin/providers", "/admin/audit-events"])(
    "allows the verified %s read while refusing mutations", (path) => {
      expect(isAllowedPortalRequest(path, "GET", portalRuntime)).toBe(true);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(isAllowedPortalRequest(path, method, portalRuntime)).toBe(false);
      }
    },
  );

  it("keeps unrelated administrative and integration operations denied", () => {
    for (const path of ["/admin/feature-flags", "/admin/users", "/integrations/health", "/integrations/failures"]) {
      expect(isAllowedPortalRequest(path, "GET", portalRuntime)).toBe(false);
    }
    expect(isAllowedPortalRequest("/admin/bookings/booking-1/assign", "POST", portalRuntime)).toBe(false);
    expect(isAllowedPortalRequest("/integrations/events/event-1/retry", "POST", portalRuntime)).toBe(false);
  });

  it("uses the existing operations read models", () => {
    for (const path of ["/operations/control-center/queue", "/operations/control-center/integration-failures", "/portal/operations/overview"]) {
      expect(isAllowedPortalRequest(path, "GET", portalRuntime)).toBe(true);
    }
  });
});
