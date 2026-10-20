import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, useUpdateStore } from "../update-store";

describe("update store", () => {
  beforeEach(() => useUpdateStore.setState({ waiting: null, dismissed: false }));

  it("shows again when a newer version arrives after Later", () => {
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker;
    useUpdateStore.getState().setWaiting(worker);
    useUpdateStore.getState().dismiss();
    expect(useUpdateStore.getState().dismissed).toBe(true);
    useUpdateStore.getState().setWaiting(worker);
    expect(useUpdateStore.getState().dismissed).toBe(false);
  });

  it("tells the waiting worker to take over, and does nothing when none is waiting", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("navigator", { serviceWorker: { addEventListener: vi.fn() } });
    applyUpdate();
    expect(postMessage).not.toHaveBeenCalled();
    useUpdateStore.getState().setWaiting({ postMessage } as unknown as ServiceWorker);
    applyUpdate();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    vi.unstubAllGlobals();
  });
});
