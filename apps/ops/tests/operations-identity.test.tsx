// @vitest-environment jsdom

import { type PortalSessionView, usePortalSession } from "@breero/portal";
import { act, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import OperationsLayout from "../app/(operations)/layout";
import { useOps } from "../lib/session";

let state: ReturnType<typeof usePortalSession>["state"];
let mounts = 0;
let root: Root | undefined;
const request = async <T,>(): Promise<T> => undefined as T;

vi.mock("@breero/portal", () => ({
  PortalSessionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  PortalApplication: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  PortalNotice: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
  usePortalSession: () => ({ state, request, signOut: async () => undefined }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/queue",
  useRouter: () => ({ push: vi.fn() }),
}));

function Consumer() {
  useOps();
  const [identity] = useState(() => ++mounts);
  return <input aria-label="Private draft" defaultValue={String(identity)} />;
}


function session(roles: string[]): PortalSessionView {
  const user = {
    id: "operator-1", email: "operator@example.com", full_name: "Operator",
    role: "operations", is_active: true, email_verified: true,
  };
  return {
    user, csrf_token: "test-csrf", expires_at: 1,
    context: {
      user, brand_key: "breero", roles, departments: ["providers"],
      permissions: ["provider.profile.read"], assignments: [],
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

it.each(["brand", "assignments", "roles", "permissions"] as const)(
  "discards same-user private component state when %s changes",
  async (field) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const before = session(["operations"]);
    state = { status: "authenticated", session: before };
    await act(async () => root?.render(<OperationsLayout><Consumer /></OperationsLayout>));
    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    if (input) input.value = "private-unsaved-draft";
    const after = structuredClone(before);
    if (field === "brand") after.context.brand_key = "other-brand";
    if (field === "assignments") after.context.assignments = [{
      role: "operations", department: "providers", tenant_scope: "vendor", vendor_id: "other-vendor", is_primary: true,
    }];
    if (field === "roles") after.context.roles = ["operations", "ops_manager"];
    if (field === "permissions") after.context.permissions = [];
    state = { status: "authenticated", session: after };
    await act(async () => root?.render(<OperationsLayout><Consumer /></OperationsLayout>));
    expect(container.querySelector("input")).not.toBe(input);
    expect(container.querySelector("input")?.value).not.toBe("private-unsaved-draft");
  },
);
