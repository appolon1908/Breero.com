import { isAllowedPortalRequest } from "@breero/portal/server";
import { describe, expect, it } from "vitest";
import { portalRuntime } from "../portal.config";

describe("admin access catalog BFF authority", () => {
  it("allows only the exact catalog GET while preserving existing admin routes", () => {
    expect(isAllowedPortalRequest("/auth/access/catalog", "GET", portalRuntime)).toBe(true);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(isAllowedPortalRequest("/auth/access/catalog", method, portalRuntime)).toBe(false);
    }
    for (const path of ["/auth", "/auth/access", "/auth/access/me", "/auth/access/catalogue", "/auth/access/catalog/users"]) {
      expect(isAllowedPortalRequest(path, "GET", portalRuntime)).toBe(false);
    }
    expect(isAllowedPortalRequest("/admin/users/user-1/access", "PUT", portalRuntime)).toBe(true);
    expect(isAllowedPortalRequest("/finance/payout-batches/batch-1", "GET", portalRuntime)).toBe(true);
  });
});
