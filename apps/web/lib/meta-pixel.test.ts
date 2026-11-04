import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveConsentChoice } from "./consent";

describe("Meta Pixel consent-gated loader", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.getElementById("breero-meta-pixel")?.remove();
    delete window.fbq;
    delete window._fbq;
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  afterEach(() => {
    document.getElementById("breero-meta-pixel")?.remove();
    delete window.fbq;
    delete window._fbq;
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  it("does not load the pixel before consent or with analytics-only permission", async () => {
    const { syncMetaPixel, META_PIXEL_SCRIPT_ID } = await import("./meta-pixel");
    syncMetaPixel("/");
    expect(document.getElementById(META_PIXEL_SCRIPT_ID)).toBeNull();
    expect(window.fbq).toBeUndefined();

    saveConsentChoice(true, false);
    syncMetaPixel("/");
    expect(document.getElementById(META_PIXEL_SCRIPT_ID)).toBeNull();
    expect(window.fbq).toBeUndefined();
  });

  it("installs the script in the head and tracks SPA routes only once", async () => {
    const { syncMetaPixel, META_PIXEL_SCRIPT_ID, META_PIXEL_ID } = await import("./meta-pixel");
    saveConsentChoice(false, true);
    syncMetaPixel("/");
    expect(document.head.querySelectorAll(`#${META_PIXEL_SCRIPT_ID}`)).toHaveLength(1);
    expect(window.fbq?.queue).toEqual([
      ["init", META_PIXEL_ID],
      ["consent", "grant"],
      ["trackSingle", META_PIXEL_ID, "PageView"],
    ]);

    syncMetaPixel("/");
    syncMetaPixel("/services");
    expect(window.fbq?.queue?.filter((call) => call[0] === "trackSingle")).toEqual([
      ["trackSingle", META_PIXEL_ID, "PageView"],
      ["trackSingle", META_PIXEL_ID, "PageView"],
    ]);
    expect(document.querySelectorAll(`#${META_PIXEL_SCRIPT_ID}`)).toHaveLength(1);
  });

  it("stops tracking on withdrawal and can resume after re-consent", async () => {
    const { syncMetaPixel, META_PIXEL_ID } = await import("./meta-pixel");
    saveConsentChoice(true, true);
    syncMetaPixel("/services");

    saveConsentChoice(false, false);
    syncMetaPixel("/services");
    syncMetaPixel("/pricing");
    expect(window.fbq?.queue?.some((call) => call[0] === "revoke")).toBe(false);
    expect(window.fbq?.queue).toContainEqual(["consent", "revoke"]);
    expect(window.fbq?.queue?.filter((call) => call[0] === "trackSingle")).toHaveLength(1);

    saveConsentChoice(false, true);
    syncMetaPixel("/services");
    expect(window.fbq?.queue).toContainEqual(["consent", "grant"]);
    expect(window.fbq?.queue?.filter((call) => call[0] === "trackSingle")).toHaveLength(2);
    expect(window.fbq?.queue).toContainEqual(["trackSingle", META_PIXEL_ID, "PageView"]);
  });

  it("honors Global Privacy Control even with stored advertising consent", async () => {
    const { syncMetaPixel, META_PIXEL_SCRIPT_ID } = await import("./meta-pixel");
    saveConsentChoice(true, true);
    Object.defineProperty(navigator, "globalPrivacyControl", { configurable: true, value: true });
    syncMetaPixel("/");
    expect(document.getElementById(META_PIXEL_SCRIPT_ID)).toBeNull();
    expect(window.fbq).toBeUndefined();
  });
});
