import { readConsentChoice } from "./consent";

export const META_PIXEL_ID = "965185126235275";
export const META_PIXEL_SCRIPT_ID = "breero-meta-pixel";

type FacebookPixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    fbq?: FacebookPixel;
    _fbq?: FacebookPixel;
  }
}

let initialized = false;
let permissionGranted = false;
let lastTrackedPath: string | null = null;

function initializePixel(): void {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
      else fbq.queue?.push(args);
    }) as FacebookPixel;

    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.push = fbq;
    window.fbq = fbq;
    window._fbq = fbq;

    // The script is intentionally absent until advertising consent is granted.
    // Put it in <head>, once, so all public site routes can use the same pixel.
    const script = document.createElement("script");
    script.id = META_PIXEL_SCRIPT_ID;
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }

  if (!initialized) {
    window.fbq?.("init", META_PIXEL_ID);
    initialized = true;
  }
}

/**
 * One PageView per client-side route, only after explicit advertising consent.
 * The consent banner uses the separate advertising flag; analytics-only
 * permission must not enable Meta Pixel.
 */
export function syncMetaPixel(pathname: string): void {
  const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
  const allowed = !gpc && readConsentChoice()?.advertising === true;

  if (!allowed) {
    if (permissionGranted) window.fbq?.("consent", "revoke");
    permissionGranted = false;
    lastTrackedPath = null;
    return;
  }

  initializePixel();
  if (!permissionGranted) window.fbq?.("consent", "grant");
  permissionGranted = true;

  if (lastTrackedPath !== pathname) {
    // Track only this pixel even if another integration adds its own pixel.
    window.fbq?.("trackSingle", META_PIXEL_ID, "PageView");
    lastTrackedPath = pathname;
  }
}
