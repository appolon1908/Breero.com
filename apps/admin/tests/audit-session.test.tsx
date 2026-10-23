// @vitest-environment jsdom

import { type PortalSessionView } from "@breero/portal";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import AdministrationLayout from "../app/(administration)/layout";
import AuditPage from "../app/(administration)/audit/page";

let deniedStatus = 0;
let root: Root | undefined;
const calls: string[] = [];
const request = async <T,>(path: string): Promise<T> => {
  calls.push(path);
  if (path === "/admin/audit/catalog") return {} as T;
  if (deniedStatus) throw Object.assign(new Error("private-server-detail"), {
    problem: { status: deniedStatus, message: "private-server-detail", code: "ACCESS_DENIED" },
  });
  return {
    occurred_from: "2026-10-22T00:00:00Z", occurred_to: "2026-10-23T00:00:00Z", next_cursor: null,
    items: [{
      id: "event-1", action: "private-audit-action", occurred_at: "2026-10-23T00:00:00Z",
      result: "success", category: "role_change", actor: { type: "user" }, resource: { type: "user" },
      correlation_id: null,
    }],
  } as T;
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/audit",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@breero/portal", () => ({
  PortalSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PortalApplication: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PortalNotice: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  usePortalSession: () => ({ state: { status: "authenticated", session: session(["admin"]) }, request, signOut: async () => undefined }),
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

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

it.each([401, 403])("clears audit records after catalog admission followed by %s", async (status) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  deniedStatus = 0;
  calls.length = 0;
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(<AdministrationLayout><AuditPage /></AdministrationLayout>));
  expect(calls).toEqual(["/admin/audit/catalog"]);
  const submit = () => {
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  };
  await act(async () => submit());
  expect(container.textContent).toContain("private-audit-action");
  deniedStatus = status;
  await act(async () => submit());
  expect(container.textContent).not.toContain("private-audit-action");
  expect(container.textContent).not.toContain("private-server-detail");
  expect(container.textContent).toContain(status === 401 ? "session has expired" : "not authorized");
  expect(container.querySelector("form")).toBeNull();
});
