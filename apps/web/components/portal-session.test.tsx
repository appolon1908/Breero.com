import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalApp, type PortalConfig } from "../../../packages/portal/src/index";

const config: PortalConfig = {
  name: "Administration",
  eyebrow: "BREERO",
  allowedRoles: ["admin"],
  sections: [{ label: "Bookings", path: "/bookings", description: "Manage bookings" }],
};
const user = { email: "admin@example.test", full_name: "Admin User", role: "admin" };

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test/api/v1"));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("portal session boundary", () => {
  it("rejects a restored session whose role is outside this portal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ...user, role: "vendor_admin" })));

    render(<PortalApp config={config} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("not authorized for this portal");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Portal navigation" })).not.toBeInTheDocument();
  });

  it("restores a session whose role is allowed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(user)));

    render(<PortalApp config={config} />);

    expect(await screen.findByRole("navigation", { name: "Portal navigation" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("clears privileged state and returns to sign in after a data request receives 401", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(user))
      .mockResolvedValueOnce(jsonResponse([{ id: "private-booking", customer: "Private customer" }]))
      .mockResolvedValueOnce(jsonResponse({ message: "Session expired" }, 401));
    vi.stubGlobal("fetch", fetch);

    render(<PortalApp config={config} />);
    const navigation = await screen.findByRole("navigation", { name: "Portal navigation" });
    expect(navigation).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(await screen.findByText("Private customer")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible());
    expect(screen.queryByRole("navigation", { name: "Portal navigation" })).not.toBeInTheDocument();
    expect(screen.queryByText("Private customer")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Session expired");
    expect(fetch).toHaveBeenLastCalledWith("https://api.example.test/api/v1/bookings", expect.objectContaining({
      credentials: "include",
      cache: "no-store",
    }));
  });
  it("ignores data from an expired session after another session signs in", async () => {
    let finishExpiredRequest!: (response: Response) => void;
    const expiredRequest = new Promise<Response>((resolve) => { finishExpiredRequest = resolve; });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse(user))
      .mockReturnValueOnce(expiredRequest)
      .mockResolvedValueOnce(jsonResponse({ message: "Session expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: { ...user, email: "other@example.test" } })));

    render(<PortalApp config={config} />);
    await screen.findByRole("navigation", { name: "Portal navigation" });
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    await screen.findByRole("button", { name: "Sign in" });

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "other@example.test" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("navigation", { name: "Portal navigation" });

    await act(async () => {
      finishExpiredRequest(jsonResponse([{ id: "old-booking", customer: "Expired-session customer" }]));
    });
    expect(screen.queryByText("Expired-session customer")).not.toBeInTheDocument();
  });

});
