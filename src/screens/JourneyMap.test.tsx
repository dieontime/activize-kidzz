import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { JourneyMap } from "./JourneyMap";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { World, Mission } from "@/content/types";

const world: World = { id: "world-jungle", order: 1, theme: "jungle", name: "Jungle Jump", missionIds: ["mission-001"], art: "worlds/jungle.png" };
const missions: Mission[] = [{ id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1: Wake Up Your Brain", activityIds: ["activity-cross-crawl"] }];

describe("JourneyMap", () => {
  beforeAll(() => {
    initNavigation();
  });

  it("shows the world name", () => {
    render(<JourneyMap world={world} missions={missions} />);
    expect(screen.getByText(/jungle jump/i)).toBeInTheDocument();
  });

  it("renders a focusable node per mission and starts it on press", async () => {
    const user = userEvent.setup();
    render(<JourneyMap world={world} missions={missions} />);
    await user.click(screen.getByRole("button", { name: /day 1/i }));
    expect(useUiStore.getState().screen).toBe("mission");
    expect(useUiStore.getState().activeMissionId).toBe("mission-001");
  });

  it("puts D-pad focus on the first mission by default", async () => {
    render(<JourneyMap world={world} missions={missions} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /day 1/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("navigates to the Trophy Shelf when its button is pressed", async () => {
    const user = userEvent.setup();
    render(<JourneyMap world={world} missions={missions} />);
    await user.click(screen.getByRole("button", { name: /trophy shelf/i }));
    expect(useUiStore.getState().screen).toBe("trophyShelf");
  });
});

describe("JourneyMap lock states", () => {
  const threeMissions: Mission[] = [
    { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1: Wake Up", activityIds: [] },
    { id: "mission-002", worldId: "world-jungle", node: 2, title: "Day 2: Stretch It Out", activityIds: [] },
    { id: "mission-003", worldId: "world-jungle", node: 3, title: "Day 3: Cool Down", activityIds: [] },
  ];

  afterEach(() => useProgressStore.getState().reset());

  it("renders a mission before the current node as completed (still a clickable button)", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.getByRole("button", { name: /day 1/i })).toBeInTheDocument();
  });

  it("renders the mission at the current node as a focusable button", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /day 2/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("renders a mission after the current node as locked, not a button", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01", totalMissionsCompleted: 1,
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.queryByRole("button", { name: /day 3/i })).not.toBeInTheDocument();
    expect(screen.getByText(/day 3/i)).toBeInTheDocument();
  });

  it("renders the current mission as locked if it was already completed today", () => {
    const today = new Date().toISOString().slice(0, 10);
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: today, totalMissionsCompleted: 1,
    });
    render(<JourneyMap world={world} missions={threeMissions} />);
    expect(screen.queryByRole("button", { name: /day 2/i })).not.toBeInTheDocument();
    expect(screen.getByText(/day 2/i)).toBeInTheDocument();
  });
});
