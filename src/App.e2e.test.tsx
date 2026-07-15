import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { useUiStore } from "@/store/uiStore";
import manifest from "@/content/__fixtures__/manifest.json";
import world from "@/content/__fixtures__/world-jungle.json";
import mission from "@/content/__fixtures__/mission-001.json";
import activity from "@/content/__fixtures__/activity-cross-crawl.json";

const byPath: Record<string, unknown> = {
  "/content/manifest.json": manifest,
  "/content/worlds/world-jungle.json": world,
  "/content/missions/mission-001.json": mission,
  "/content/activities/activity-cross-crawl.json": activity,
};

beforeEach(() => {
  useUiStore.getState().goToMap();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => byPath[url] })));
});

afterEach(() => vi.unstubAllGlobals());

describe("App end-to-end", () => {
  it("boots, loads the map, runs the mission, and reaches the reward", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(screen.getByText(/you did it/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(screen.getByText(/jungle jump/i)).toBeInTheDocument();
  });
});
