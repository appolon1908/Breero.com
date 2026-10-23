import type { PortalRuntimeConfig } from "@breero/portal";

export const portalRuntime = {
  kind: "ops",
  title: "BREERO Operations",
  eyebrow: "Dispatch and service delivery",
  allowedRoles: ["operations", "ops_manager", "admin", "superadmin"],
  apiRules: [
    { prefix: "/portal/capabilities", methods: ["GET"] },
    { prefix: "/portal/operations", methods: ["GET"] },
    { prefix: "/operations", methods: ["GET", "POST", "PUT", "PATCH"] },
    { prefix: "/jobs", methods: ["GET", "POST", "PATCH"] },
    { prefix: "/vendors", methods: ["GET", "PATCH"] },
    { prefix: "/bookings", methods: ["GET", "POST", "PATCH"] },
    { prefix: "/admin/bookings", methods: ["GET"] },
    { prefix: "/admin/providers", methods: ["GET"] },
    { prefix: "/admin/audit-events", methods: ["GET"] },
    { prefix: "/admin/provider-applications", methods: ["GET", "POST", "PATCH"] },
    { prefix: "/services", methods: ["GET"] },
  ],
} as const satisfies PortalRuntimeConfig;
