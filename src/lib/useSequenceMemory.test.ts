import { renderHook, waitFor, act } from "@testing-library/react";
import { useSequenceMemory } from "./useSequenceMemory";

describe("useSequenceMemory", () => {
  it("starts in the watching phase at step 0", () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10, successFlashMs: 10 }));
    expect(result.current.phase).toBe("watching");
    expect(result.current.watchIndex).toBe(0);
  });

  it("advances the watch step over time, then enters input", async () => {
    // stepMs must clear waitFor's ~50ms poll interval, or watchIndex can
    // advance past 1 between polls before this assertion ever observes it.
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 100, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.watchIndex).toBe(1));
    await waitFor(() => expect(result.current.phase).toBe("input"));
  });

  it("ignores submit calls while still in the watching phase", () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10000, successFlashMs: 10 }));
    act(() => result.current.submit("🐱"));
    expect(result.current.phase).toBe("watching");
    expect(result.current.progress).toBe(0);
  });

  it("advances progress on a correct submit and calls onComplete after the full sequence", async () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], onComplete, { stepMs: 10, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("input"));
    act(() => result.current.submit("🐱"));
    expect(result.current.progress).toBe(1);
    act(() => result.current.submit("🐶"));
    await waitFor(() => expect(result.current.phase).toBe("success"));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("resets progress and replays the watch phase on a wrong submit", async () => {
    const { result } = renderHook(() => useSequenceMemory(["🐱", "🐶"], () => {}, { stepMs: 10, successFlashMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("input"));
    act(() => result.current.submit("🐶")); // wrong -- sequence[0] is "🐱"
    expect(result.current.phase).toBe("watching");
    expect(result.current.progress).toBe(0);
    expect(result.current.watchIndex).toBe(0);
    await waitFor(() => expect(result.current.phase).toBe("input"));
  });
});
