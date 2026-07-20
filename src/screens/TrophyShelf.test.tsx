import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { TrophyShelf } from "./TrophyShelf";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

const badges: Badge[] = [
  { id: "badge-streak-3", name: "3-Day Streak", emoji: "🔥", rule: { kind: "streak", value: 3 } },
  { id: "badge-streak-7", name: "7-Day Streak", emoji: "🌟", rule: { kind: "streak", value: 7 } },
];

describe("TrophyShelf", () => {
  beforeAll(() => initNavigation());
  afterEach(() => useProgressStore.getState().reset());

  it("shows an earned badge's name and emoji", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<TrophyShelf badges={badges} />);
    expect(screen.getByText("3-Day Streak")).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
  });

  it("shows an unearned badge as locked, hiding its name and emoji", () => {
    useProgressStore.getState().setEarnedBadgeIds(["badge-streak-3"]);
    render(<TrophyShelf badges={badges} />);
    expect(screen.queryByText("7-Day Streak")).not.toBeInTheDocument();
    expect(screen.getAllByText("Locked").length).toBeGreaterThan(0);
  });

  it("puts D-pad focus on the Back to Map button by default", async () => {
    render(<TrophyShelf badges={badges} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );
  });

  it("returns to the map when Back to Map is pressed", async () => {
    const user = userEvent.setup();
    render(<TrophyShelf badges={badges} />);
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(useUiStore.getState().screen).toBe("map");
  });
});
