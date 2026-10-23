// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResource, type Resource } from "../components/ui";

type PrivateRecord = { secret: string };
let root: Root | undefined;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("partner resource authorization refresh", () => {
  it.each([401, 403, 500])("clears private data and actions while reloading and after %s", async (status) => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    const observed: { current?: Resource<PrivateRecord> } = {};
    let rejectReload: (reason: Error) => void = () => { throw new Error("reload did not start"); };
    const loader = vi.fn<() => Promise<PrivateRecord>>()
      .mockResolvedValueOnce({ secret: "private-record" })
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectReload = reject; }));

    function Probe() {
      const current = useResource(loader);
      observed.current = current;
      return <>{current.data ? <button>{current.data.secret}</button> : current.error ?? "Loading"}</>;
    }

    await act(async () => root?.render(<Probe />));
    expect(container.textContent).toContain("private-record");

    await act(async () => { void observed.current?.reload(); });
    expect(observed.current?.loading).toBe(true);
    expect(observed.current?.data).toBeNull();
    expect(container.querySelector("button")).toBeNull();

    await act(async () => rejectReload(Object.assign(new Error("Access refresh failed"), { status })));
    expect(observed.current?.loading).toBe(false);
    expect(observed.current?.data).toBeNull();
    expect(container.textContent).toContain("Access refresh failed");
    expect(container.querySelector("button")).toBeNull();
  });
});


it("ignores an older pending response after its loader changes", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  let resolveOld: (record: PrivateRecord) => void = () => { throw new Error("old request not started"); };
  const oldLoader = () => new Promise<PrivateRecord>((resolve) => { resolveOld = resolve; });
  const newLoader = async () => ({ secret: "current-record" });
  function Probe({ loader }: { loader: () => Promise<PrivateRecord> }) {
    const resource = useResource(loader);
    return <>{resource.data?.secret ?? "Loading"}</>;
  }
  await act(async () => root?.render(<Probe loader={oldLoader} />));
  await act(async () => root?.render(<Probe loader={newLoader} />));
  expect(container.textContent).toBe("current-record");
  await act(async () => resolveOld({ secret: "old-private-record" }));
  expect(container.textContent).toBe("current-record");
});
