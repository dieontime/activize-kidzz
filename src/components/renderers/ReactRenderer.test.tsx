import { render, screen } from "@testing-library/react";
import { ReactRenderer } from "./ReactRenderer";
import type { MovementActivity, BreathingActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "react", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee.",
};

const breathing: BreathingActivity = {
  id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3",
  renderer: "react", asset: "belly", cycles: 4,
};

describe("ReactRenderer", () => {
  it("shows the movement instructions", () => {
    render(<ReactRenderer activity={movement} />);
    expect(screen.getByText(/touch hand to opposite knee/i)).toBeInTheDocument();
  });

  it("shows the breathing cycle count", () => {
    render(<ReactRenderer activity={breathing} />);
    expect(screen.getByText(/4 times/i)).toBeInTheDocument();
  });
});
