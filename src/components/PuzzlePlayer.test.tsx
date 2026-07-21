import { render, screen } from "@testing-library/react";
import { PuzzlePlayer } from "./PuzzlePlayer";
import { initNavigation } from "@/navigation/initNavigation";
import type { PuzzleActivity } from "@/content/types";

const activity: PuzzleActivity = {
  id: "p1", type: "puzzle", title: "Remember the Order", ageBands: ["6-8"], narration: "p1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🐶"] },
};

describe("PuzzlePlayer", () => {
  beforeAll(() => initNavigation());

  it("renders the registered component for the activity's puzzleType", () => {
    render(<PuzzlePlayer activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🐶" })).toBeInTheDocument();
  });
});
