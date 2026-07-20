import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { ExercisePlayer } from "./ExercisePlayer";
import type { MovementActivity, BreathingActivity } from "@/content/types";

const movement: MovementActivity = {
  id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3",
  renderer: "react", asset: "cross-crawl", pacing: { reps: 2, tempoMs: 100 }, instructions: "Touch hand to opposite knee.",
};

const breathing: BreathingActivity = {
  id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3",
  renderer: "react", asset: "belly", cycles: 1,
};

describe("ExercisePlayer", () => {
  beforeAll(() => initNavigation());
  afterEach(() => vi.useRealTimers());

  it("starts with the validate button disabled", () => {
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    expect(screen.getByRole("button", { name: /we did it/i })).toBeDisabled();
  });

  it("enables the validate button after the movement gate duration (reps * tempoMs)", () => {
    vi.useFakeTimers();
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    act(() => {
      vi.advanceTimersByTime(2 * 100);
    });
    expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled();
  });

  it("enables the validate button after the breathing gate duration (cycles * BREATH_CYCLE_MS)", () => {
    vi.useFakeTimers();
    render(<ExercisePlayer activity={breathing} onValidated={() => {}} />);
    act(() => {
      vi.advanceTimersByTime(1 * 4000);
    });
    expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled();
  });

  it("calls onValidated when pressed after the gate elapses", async () => {
    vi.useFakeTimers();
    const onValidated = vi.fn();
    render(<ExercisePlayer activity={movement} onValidated={onValidated} />);
    act(() => {
      vi.advanceTimersByTime(2 * 100);
    });
    expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled();
    vi.useRealTimers();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /we did it/i }));
    expect(onValidated).toHaveBeenCalledTimes(1);
  });

  it("renders the ReactRenderer content for a react-renderer activity", () => {
    render(<ExercisePlayer activity={movement} onValidated={() => {}} />);
    expect(screen.getByText(/touch hand to opposite knee/i)).toBeInTheDocument();
  });
});
