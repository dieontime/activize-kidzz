import { renderHook, waitFor } from "@testing-library/react";
import { useInterstitial } from "./useInterstitial";
import { interstitialActivities } from "@/content/interstitialActivities";

describe("useInterstitial", () => {
  it("starts hidden", () => {
    const { result } = renderHook(() => useInterstitial(false, { delayMs: 10, readyFlashMs: 10 }));
    expect(result.current.state).toBe("hidden");
  });

  it("stays hidden throughout a fast resolve (pending flips false before delayMs)", async () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useInterstitial(pending, { delayMs: 50, readyFlashMs: 10 }),
      { initialProps: { pending: true } },
    );
    rerender({ pending: false });
    await new Promise((resolve) => setTimeout(resolve, 80)); // outlive the delay window
    expect(result.current.state).toBe("hidden");
  });

  it("shows after delayMs elapses while still pending", async () => {
    const { result } = renderHook(() => useInterstitial(true, { delayMs: 10, readyFlashMs: 10 }));
    await waitFor(() => expect(result.current.state).toBe("showing"));
    const current = result.current;
    expect(current.state).toBe("showing");
    if (current.state !== "showing") throw new Error("unreachable");
    expect(interstitialActivities.map((a) => a.id)).toContain(current.activity.id);
  });

  it("flashes ready then hides once pending resolves after showing", async () => {
    const { result, rerender } = renderHook(
      ({ pending }) => useInterstitial(pending, { delayMs: 10, readyFlashMs: 10 }),
      { initialProps: { pending: true } },
    );
    await waitFor(() => expect(result.current.state).toBe("showing"));
    rerender({ pending: false });
    await waitFor(() => expect(result.current.state).toBe("ready"));
    await waitFor(() => expect(result.current.state).toBe("hidden"));
  });
});
