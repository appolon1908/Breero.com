import type { ReactNode } from "react";
import { Shell } from "../../components/Shell";
import "../ops.css";

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
