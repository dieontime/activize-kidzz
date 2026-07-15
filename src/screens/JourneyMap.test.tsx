import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JourneyMap } from "./JourneyMap";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

const world: World = { id: "world-jungle", order: 1, theme: "jungle", name: "Jungle Jump", missionIds: ["mission-001"], art: "worlds/jungle.png" };
const missions: Mission[] = [{ id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1: Wake Up Your Brain", activityIds: ["activity-cross-crawl"] }];

describe("JourneyMap", () => {
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
});
