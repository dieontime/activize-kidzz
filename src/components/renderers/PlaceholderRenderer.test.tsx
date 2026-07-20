import { render, screen } from "@testing-library/react";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { MovementActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "rive", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

describe("PlaceholderRenderer", () => {
  it("shows a placeholder message regardless of activity content", () => {
    render(<PlaceholderRenderer activity={movement} />);
    expect(screen.getByText(/ask a parent to help/i)).toBeInTheDocument();
  });
});
