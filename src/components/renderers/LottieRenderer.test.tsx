import { render, screen, waitFor } from "@testing-library/react";
import Lottie from "lottie-react";
import { LottieRenderer } from "./LottieRenderer";
import type { BreathingActivity } from "@/content/types";

const breathing: BreathingActivity = {
  id: "a1", type: "breathing", title: "Balloon Breathing", ageBands: ["6-8"],
  narration: "Let's do Balloon Breathing!", renderer: "lottie", asset: "balloon-breathing", cycles: 4,
};

describe("LottieRenderer", () => {
  beforeEach(() => {
    vi.mocked(Lottie).mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("fetches the asset JSON from /content/lottie/<asset>.json and renders Lottie with it", async () => {
    const animationData = { v: "5.5.7", fr: 30, layers: [] };
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => animationData }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LottieRenderer activity={breathing} />);

    await waitFor(() => expect(Lottie).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith("/content/lottie/balloon-breathing.json");
    expect(vi.mocked(Lottie).mock.calls[0][0]).toMatchObject({
      animationData,
      loop: true,
      autoplay: true,
    });
  });

  it("falls back to the placeholder illustration when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    render(<LottieRenderer activity={breathing} />);

    await waitFor(() => expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument());
  });
});
