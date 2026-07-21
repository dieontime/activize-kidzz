import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SequenceMemoryPuzzle } from "./SequenceMemoryPuzzle";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";
import type { PuzzleActivity } from "@/content/types";

const activity: PuzzleActivity = {
  id: "p1", type: "puzzle", title: "Remember the Order", ageBands: ["6-8"], narration: "p1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🐶"] },
};

describe("SequenceMemoryPuzzle", () => {
  beforeAll(() => initNavigation());

  it("renders every icon in the grid", () => {
    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "🐶" })).toBeInTheDocument();
  });

  it("disables the grid during the watch phase", () => {
    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: "🐱" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "🐶" })).toBeDisabled();
  });

  it("ArrowRight moves D-pad focus to the geometrically-next icon", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.getAttribute?.("aria-label") ?? el.textContent;
      const index = activity.puzzle.icons.findIndex((icon) => icon === label);
      return index === -1 ? null : index;
    }, 4);

    render(<SequenceMemoryPuzzle activity={activity} onValidated={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "🐱" })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 39, code: "ArrowRight", key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("button", { name: "🐶" })).toHaveAttribute("data-focused", "true"));
    restore();
  });

  it("solves the puzzle end-to-end with real default timings and calls onValidated", async () => {
    const onValidated = vi.fn();
    const user = userEvent.setup();
    render(<SequenceMemoryPuzzle activity={activity} onValidated={onValidated} />);

    await waitFor(() => expect(screen.getByRole("button", { name: "🐱" })).not.toBeDisabled(), { timeout: 3000 });

    await user.click(screen.getByRole("button", { name: "🐱" }));
    await user.click(screen.getByRole("button", { name: "🐶" }));

    await waitFor(() => expect(screen.getByText(/got it/i)).toBeInTheDocument(), { timeout: 1000 });
    await waitFor(() => expect(onValidated).toHaveBeenCalledTimes(1), { timeout: 1000 });
  }, 10000);
});
