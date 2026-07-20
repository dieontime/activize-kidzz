import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { RewardScreen } from "./RewardScreen";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

const streakBadge: Badge = { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } };

describe("RewardScreen", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the mission title in the reward message", () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.getByText(/day 1: wake up your brain complete/i)).toBeInTheDocument();
  });

  it("puts D-pad focus on the Back to Map button by default", async () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("returns to the map when Back to Map is pressed", async () => {
    const user = userEvent.setup();
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(useUiStore.getState().screen).toBe("map");
  });
});

describe("RewardScreen streak display", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("shows a streak line when the streak is 2 or more days", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 3, longestStreak: 3, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 3,
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
  });

  it("does not show a streak line on day 1 (no streak yet)", () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2026-07-17", totalMissionsCompleted: 1,
    });
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[]} />);
    expect(screen.queryByText(/-day streak/i)).not.toBeInTheDocument();
  });
});

describe("RewardScreen badge display", () => {
  afterEach(() => useProgressStore.getState().reset());

  it("shows a newly earned badge's emoji and name", () => {
    useProgressStore.getState().awardBadges(["badge-streak-3"]);
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.getByText(/3-day streak/i)).toBeInTheDocument();
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });

  it("shows nothing extra when no badge was newly earned", () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });

  it("does not show a badge earned in an earlier session, only newly earned ones", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" badges={[streakBadge]} />);
    expect(screen.queryByText(/🔥/)).not.toBeInTheDocument();
  });
});
