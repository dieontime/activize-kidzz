import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { MissionPlayer } from "./MissionPlayer";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import type { Activity, Mission } from "@/content/types";

const mission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["a1", "a2"] };
const activities: Activity[] = [
  { id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3", renderer: "react", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee." },
  { id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3", renderer: "react", asset: "belly", cycles: 4 },
];

describe("MissionPlayer", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the first activity and progress", () => {
    render(<MissionPlayer mission={mission} activities={activities} />);
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 1 of 2/i)).toBeInTheDocument();
  });

  it("advances through activities when the parent presses Done", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.getByText(/belly breaths/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 2 of 2/i)).toBeInTheDocument();
  });

  it("goes to the reward screen after the last activity", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(useUiStore.getState().screen).toBe("reward");
  });

  it("goes straight to the reward screen when the mission has no activities", async () => {
    render(<MissionPlayer mission={mission} activities={[]} />);
    await waitFor(() => expect(useUiStore.getState().screen).toBe("reward"));
  });

  it("keeps D-pad focus on the Done button across activity transitions", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /done/i })).toHaveAttribute(
        "data-focused",
        "true",
      ),
    );

    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /done/i })).toHaveAttribute(
        "data-focused",
        "true",
      ),
    );
  });
});

describe("MissionPlayer progress recording", () => {
  beforeEach(() => {
    useAuthStore.setState({
      activeProfile: { id: "profile-1", username: "SpeedyOtter", avatar: "avatar_cat", age_band: "6-8" },
    });
    useProgressStore.getState().setProgress({
      world: 0, node: 1, streakCount: 0, longestStreak: 0, lastCompletedDate: null,
    });
  });

  afterEach(() => {
    useAuthStore.getState().logout();
    useProgressStore.getState().reset();
  });

  it("advances the progress node after completing the mission at the current node", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
  });

  it("does not advance the node when replaying an already-completed mission", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />); // mission.node is 1, progress.node is 2
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the fire-and-forget write settle
    expect(useProgressStore.getState().node).toBe(2); // unchanged
  });
});
