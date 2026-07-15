import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { RewardScreen } from "./RewardScreen";
import { useUiStore } from "@/store/uiStore";

describe("RewardScreen", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the mission title in the reward message", () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" />);
    expect(screen.getByText(/day 1: wake up your brain complete/i)).toBeInTheDocument();
  });

  it("puts D-pad focus on the Back to Map button by default", async () => {
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("returns to the map when Back to Map is pressed", async () => {
    const user = userEvent.setup();
    render(<RewardScreen missionTitle="Day 1: Wake Up Your Brain" />);
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(useUiStore.getState().screen).toBe("map");
  });
});
