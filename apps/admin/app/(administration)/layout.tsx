import type { ReactNode } from "react";
import { AdminShell } from "../../components/AdminShell";
import "../admin.css";

export default function AdministrationLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
