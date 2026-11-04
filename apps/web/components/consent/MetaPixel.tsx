"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_UPDATED_EVENT } from "@/lib/consent";
import { syncMetaPixel } from "@/lib/meta-pixel";

/** Mount once in the shared AppShell to cover every Next.js page. */
export function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => syncMetaPixel(pathname || window.location.pathname);
    sync();
    window.addEventListener(CONSENT_UPDATED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, sync);
  }, [pathname]);

  return null;
}
