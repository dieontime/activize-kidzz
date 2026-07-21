import { render, screen, act } from "@testing-library/react";
import { useRive } from "@rive-app/react-canvas";
import { RiveRenderer } from "./RiveRenderer";
import type { MovementActivity } from "@/content/types";

interface UseRiveOptions {
  src: string;
  autoplay?: boolean;
  onLoadError?: () => void;
}

function StubRiveComponent() {
  return <div>rive canvas</div>;
}

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "rive", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

describe("RiveRenderer", () => {
  beforeEach(() => {
    vi.mocked(useRive).mockReset();
  });

  it("passes the activity's asset-derived src to useRive and renders the loaded RiveComponent", () => {
    vi.mocked(useRive).mockReturnValue(
      { RiveComponent: StubRiveComponent } as unknown as ReturnType<typeof useRive>,
    );
    render(<RiveRenderer activity={movement} />);
    expect(useRive).toHaveBeenCalledWith(
      expect.objectContaining({ src: "/content/rive/cross-crawl.riv", autoplay: true }),
    );
    expect(screen.getByText("rive canvas")).toBeInTheDocument();
  });

  it("falls back to the placeholder illustration when the file fails to load", () => {
    let capturedOnLoadError: (() => void) | undefined;
    vi.mocked(useRive).mockImplementation((opts: unknown) => {
      capturedOnLoadError = (opts as UseRiveOptions).onLoadError;
      return { RiveComponent: StubRiveComponent } as unknown as ReturnType<typeof useRive>;
    });
    render(<RiveRenderer activity={movement} />);
    act(() => capturedOnLoadError?.());
    expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument();
  });
});
