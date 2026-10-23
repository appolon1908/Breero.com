"use client";

import { PortalApplication, PortalNotice, PortalSessionProvider, usePortalSession } from "@breero/portal";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { createOpsApi } from "../lib/api";
import { OpsContext } from "../lib/session";
import { portalRuntime } from "../portal.config";

export const NAVIGATION = [
  { href: "/", label: "Dashboard" },
  { href: "/queue", label: "Dispatch queue" },
  { href: "/exceptions", label: "SLA & exceptions" },
  { href: "/capacity", label: "Capacity" },
  { href: "/service-areas", label: "Service areas" },
  { href: "/integrations", label: "Integration failures" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  return <PortalSessionProvider><OperationsWorkspace>{children}</OperationsWorkspace></PortalSessionProvider>;
}

function OperationsWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, request, signOut } = usePortalSession();
  const api = useMemo(() => createOpsApi(request), [request]);
  const activeId = pathname.startsWith("/jobs/") ? "/queue"
    : NAVIGATION.find((item) => item.href === pathname)?.href ?? "/";
  const session = state.status === "authenticated" ? state.session : null;
  const authorized = session?.context.roles.some((role) =>
    (portalRuntime.allowedRoles as readonly string[]).includes(role));
  // Changing identity or effective access discards any resource state from the prior session.
  const identity = session && [
    session.context.brand_key, session.user.id,
    session.context.roles.join(","), session.context.permissions.join(","),
  ].join(":");

  return (
    <PortalApplication
      config={portalRuntime}
      navigation={NAVIGATION.map((item) => ({ id: item.href, label: item.label }))}
      activeId={activeId}
      onNavigate={(href) => router.push(href)}
    >
      {session && authorized ? (
        <OpsContext.Provider key={identity} value={{ session, api, signOut }}>
          {children}
        </OpsContext.Provider>
      ) : session ? (
        <PortalNotice tone="danger" title="Access denied">
          This account is not authorized for BREERO Operations.
        </PortalNotice>
      ) : null}
    </PortalApplication>
  );
}
