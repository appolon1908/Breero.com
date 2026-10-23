"use client";

import { PortalApplication, PortalNotice, PortalSessionProvider, usePortalSession, type PortalSessionView } from "@breero/portal";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createAdminApi, type AdminApi } from "../lib/api";
import { isActivePath, NAVIGATION } from "../lib/navigation";
import { portalRuntime } from "../portal.config";

export interface AdminContextValue {
  api: AdminApi;
  session: PortalSessionView;
  signOut: () => Promise<void>;
}
const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside AdminShell");
  return value;
}

export function AdminShell({ children }: { children: ReactNode }) {
  return <PortalSessionProvider><AdministrationWorkspace>{children}</AdministrationWorkspace></PortalSessionProvider>;
}

function AdministrationWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, request, signOut } = usePortalSession();
  const api = useMemo(() => createAdminApi(request), [request]);
  const session = state.status === "authenticated" ? state.session : null;
  const authorized = session?.context.roles.some((role) =>
    (portalRuntime.allowedRoles as readonly string[]).includes(role));
  // Discard private resource and form state when effective authority changes.
  const identity = session && JSON.stringify([
    session.user.id, session.context.brand_key, session.context.assignments,
    session.context.roles, session.context.permissions,
  ]);
  const activeId = NAVIGATION.find((item) => isActivePath(pathname, item.href))?.href ?? "/";

  return (
    <PortalApplication
      config={portalRuntime}
      navigation={NAVIGATION.map((item) => ({ id: item.href, label: item.label }))}
      activeId={activeId}
      onNavigate={(href) => router.push(href)}
    >
      {session && authorized ? (
        <AdminContext.Provider key={identity} value={{ session, api, signOut }}>
          {children}
        </AdminContext.Provider>
      ) : session ? (
        <PortalNotice tone="danger" title="Access denied">
          This account is not authorized for BREERO Administration.
        </PortalNotice>
      ) : null}
    </PortalApplication>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header>
      <div>
        <p className="portal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
      </div>
      {children}
    </header>
  );
}
