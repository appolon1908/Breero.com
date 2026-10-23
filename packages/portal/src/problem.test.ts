import { describe, expect, it } from "vitest";

import { readProblem } from "./index";

describe("portal API error compatibility", () => {
  it("preserves canonical version-conflict codes for provider actions", async () => {
    const response = Response.json(
      { error: { code: "VERSION_CONFLICT", message: "This record changed." } },
      { status: 409, headers: { "x-request-id": "request-1" } },
    );
    await expect(readProblem(response)).resolves.toMatchObject({
      status: 409, code: "VERSION_CONFLICT", message: "This record changed.", requestId: "request-1",
    });
  });

  it("preserves BFF session-denial errors without exposing a token", async () => {
    const response = Response.json(
      { code: "SESSION_REQUIRED", message: "Authentication required" },
      { status: 401 },
    );
    await expect(readProblem(response)).resolves.toMatchObject({
      status: 401, code: "SESSION_REQUIRED", message: "Authentication required",
    });
  });

  it("preserves incomplete onboarding guidance", async () => {
    const response = Response.json(
      { detail: { code: "ONBOARDING_INCOMPLETE", missing: ["services", "insurance"] } },
      { status: 409 },
    );
    await expect(readProblem(response)).resolves.toMatchObject({
      code: "ONBOARDING_INCOMPLETE", details: ["services", "insurance"],
      message: "Complete every onboarding step before submitting.",
    });
  });

  it("preserves actionable field validation details", async () => {
    const response = Response.json(
      { detail: [{ loc: ["body", "phone"], msg: "Invalid phone number" }] },
      { status: 422 },
    );
    await expect(readProblem(response)).resolves.toMatchObject({
      code: "VALIDATION_ERROR", details: ["phone: Invalid phone number"],
      message: "Some fields need attention.",
    });
  });
});
