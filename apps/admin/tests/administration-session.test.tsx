import { type PortalSessionView, usePortalSession } from "@breero/portal";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import AdministrationLayout from "../app/(administration)/layout";
import { useAdmin, type AdminContextValue } from "../components/AdminShell";

let state: ReturnType<typeof usePortalSession>["state"];
const requests: { path: string; init?: RequestInit }[] = [];
const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  requests.push({ path, init });
  return undefined as T;
};
const signOut = vi.fn(async () => undefined);
let observed: AdminContextValue | undefined;

vi.mock("next/navigation", () => ({
  usePathname: () => "/finance",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@breero/portal", () => ({
  PortalSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  // Always render children: the administration adapter must independently keep its
  // consumers unmounted until the shared session is authenticated and authorized.
  PortalApplication: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PortalNotice: ({ title, children }: { title: string; children: ReactNode }) => <aside>{title}{children}</aside>,
  usePortalSession: () => ({ state, request, signOut }),
}));

function session(roles: string[]): PortalSessionView {
  const user = {
    id: "operator-1", email: "operator@example.com", full_name: "Operator",
    role: "operations", is_active: true, email_verified: true,
  };
  return {
    user, csrf_token: "test-csrf", expires_at: 1,
    context: {
      user, brand_key: "breero", roles, departments: ["dispatch"],
      permissions: ["operations.jobs.read"], assignments: [],
      identity_mode: "keycloak", dashboard_path: "/",
    },
    capabilities: {
      request_intake: true, scheduling: true, instant_booking: false, online_payments: false,
      payouts: false, automatic_assignment: false, provider_self_service: true,
      marketplace_matching: false, messaging: false, reviews: false,
      middleware_delivery: false, transactional_email_mode: "disabled",
      transactional_sms_mode: "disabled",
    },
  };
}

function Consumer() {
  observed = useAdmin();
  return <span>Private administration for {observed.session.user.id}</span>;
}

beforeEach(() => {
  state = { status: "loading" };
  observed = undefined;
  requests.length = 0;
  signOut.mockClear();
});

it.each(["loading", "anonymous"] as const)("does not render useAdmin consumers while %s", (status) => {
  state = { status };
  const html = renderToStaticMarkup(<AdministrationLayout><Consumer /></AdministrationLayout>);
  expect(observed).toBeUndefined();
  expect(html).not.toContain("Private administration");
  expect(requests).toEqual([]);
});

it("denies an authenticated account without an administration role", () => {
  state = { status: "authenticated", session: session(["vendor_admin"]) };
  const html = renderToStaticMarkup(<AdministrationLayout><Consumer /></AdministrationLayout>);
  expect(html).toContain("Access denied");
  expect(observed).toBeUndefined();
  expect(requests).toEqual([]);
});

it.each(["admin", "superadmin", "finance"])(
  "provides the shared session, sign-out and BFF request to %s consumers",
  async (role) => {
    const authenticated = session([role]);
    state = { status: "authenticated", session: authenticated };
    const html = renderToStaticMarkup(<AdministrationLayout><Consumer /></AdministrationLayout>);
    expect(html).toContain("Private administration for operator-1");
    expect(observed?.session).toBe(authenticated);
    expect(observed?.signOut).toBe(signOut);
    await observed?.api.financeStatus();
    expect(requests).toEqual([{
      path: "/finance/status",
      init: { method: "GET", headers: new Headers({ Accept: "application/json" }), body: undefined, cache: "no-store" },
    }]);
    expect(JSON.stringify(observed?.session)).not.toContain("access_token");
  },
);
