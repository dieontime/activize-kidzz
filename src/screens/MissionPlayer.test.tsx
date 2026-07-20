import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { MissionPlayer } from "./MissionPlayer";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import type { Activity, Mission } from "@/content/types";

const mission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["a1", "a2"] };
// Both activities use a 1ms gate (reps * tempoMs) so the validate button
// enables almost immediately -- breathing's gate duration math has its own
// dedicated coverage in ExercisePlayer.test.tsx; this file only needs to
// exercise MissionPlayer's own integration (advancing, focus, progress).
const activities: Activity[] = [
  { id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3", renderer: "react", asset: "cross-crawl", pacing: { reps: 1, tempoMs: 1 }, instructions: "Touch hand to opposite knee." },
  { id: "a2", type: "movement", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3", renderer: "react", asset: "belly", pacing: { reps: 1, tempoMs: 1 }, instructions: "Breathe in, breathe out." },
];

async function completeCurrentActivity(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled());
  await user.click(screen.getByRole("button", { name: /we did it/i }));
}

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

  it("advances through activities when the parent presses We did it!", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await completeCurrentActivity(user);
    expect(screen.getByText(/belly breaths/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 2 of 2/i)).toBeInTheDocument();
  });

  it("goes to the reward screen after the last activity", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    expect(useUiStore.getState().screen).toBe("reward");
  });

  it("goes straight to the reward screen when the mission has no activities", async () => {
    render(<MissionPlayer mission={mission} activities={[]} />);
    await waitFor(() => expect(useUiStore.getState().screen).toBe("reward"));
  });

  it("keeps D-pad focus on the validate button across activity transitions", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );

    await completeCurrentActivity(user);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /we did it/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("does not let the mission be completed before the gate elapses", () => {
    render(<MissionPlayer mission={mission} activities={activities} />);
    expect(screen.getByRole("button", { name: /we did it/i })).toBeDisabled();
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
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));
  });

  it("does not advance the node when replaying an already-completed mission", async () => {
    useProgressStore.getState().setProgress({
      world: 0, node: 2, streakCount: 1, longestStreak: 1, lastCompletedDate: "2020-01-01",
    });
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />); // mission.node is 1, progress.node is 2
    await completeCurrentActivity(user);
    await completeCurrentActivity(user);
    await new Promise((resolve) => setTimeout(resolve, 0)); // let the fire-and-forget write settle
    expect(useProgressStore.getState().node).toBe(2); // unchanged
  });
});
