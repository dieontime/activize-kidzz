import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useProgressStore } from "@/store/progressStore";
import manifest from "@/content/__fixtures__/manifest.json";
import world from "@/content/__fixtures__/world-jungle.json";
import mission from "@/content/__fixtures__/mission-001.json";
import activity from "@/content/__fixtures__/activity-cross-crawl.json";
import badgeStreak3 from "@/content/__fixtures__/badge-streak-3.json";
import badgeStreak7 from "@/content/__fixtures__/badge-streak-7.json";
import badgeWorldComplete from "@/content/__fixtures__/badge-world-complete-jungle.json";
import badgeMissionsTotal from "@/content/__fixtures__/badge-missions-total.json";

const byPath: Record<string, unknown> = {
  "/content/manifest.json": manifest,
  "/content/worlds/world-jungle.json": world,
  "/content/missions/mission-001.json": mission,
  "/content/activities/activity-cross-crawl.json": activity,
  "/content/badges/badge-streak-3.json": badgeStreak3,
  "/content/badges/badge-streak-7.json": badgeStreak7,
  "/content/badges/badge-world-complete-jungle.json": badgeWorldComplete,
  "/content/badges/badge-missions-total.json": badgeMissionsTotal,
};

beforeEach(() => {
  useUiStore.getState().goToMap();
  useProgressStore.getState().reset();
  window.localStorage.clear();
  useAuthStore.setState({
    authScreen: null,
    activeProfile: { id: "e2e-profile", username: "TestKid", avatar: "avatar_cat", age_band: "6-8" },
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => byPath[url] })));
});

afterEach(() => vi.unstubAllGlobals());

describe("App end-to-end", () => {
  // Real content pacing (activity-cross-crawl.json: 6 reps * 1200ms) means a
  // real ~7.2s gate before the validate button enables in the two tests
  // below -- both get an explicit timeout past vitest's 5000ms default.
  it("boots, loads the map, runs the mission, and reaches the reward", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /wake up your brain/i })).toHaveAttribute("data-focused", "true"),
    );

    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled(),
      { timeout: 8000 },
    );
    await user.click(screen.getByRole("button", { name: /we did it/i }));
    await waitFor(() => expect(screen.getByText(/you did it/i)).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /back to map/i })).toHaveAttribute("data-focused", "true"),
    );

    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(screen.getByText(/jungle jump/i)).toBeInTheDocument();
  }, 10000);

  it("recovers from a failed load by retrying", async () => {
    const user = userEvent.setup();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls += 1;
        if (calls === 1) throw new Error("network down");
        return { ok: true, json: async () => byPath[url] };
      }),
    );

    render(<App />);

    await waitFor(() => expect(screen.getByText(/let's try again/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  });

  it("persists progress across a reload: the advanced node survives an in-memory reset", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /wake up your brain/i })).toHaveAttribute("data-focused", "true"),
    );
    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));
    await waitFor(
      () => expect(screen.getByRole("button", { name: /we did it/i })).not.toBeDisabled(),
      { timeout: 8000 },
    );
    await user.click(screen.getByRole("button", { name: /we did it/i }));
    await waitFor(() => expect(screen.getByText(/you did it/i)).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /back to map/i }));
    await waitFor(() => expect(useProgressStore.getState().node).toBe(2));

    unmount();
    // Simulate a real page reload: reset in-memory state (a fresh JS
    // runtime would start here), but keep the persisted mockProgressBackend
    // data intact -- that's the whole point of this test.
    useProgressStore.getState().reset();
    useUiStore.getState().goToMap();
    expect(useProgressStore.getState().node).toBe(1); // in-memory state genuinely cleared

    const { loadProgress } = await import("@/lib/progress");
    await loadProgress("e2e-profile");
    expect(useProgressStore.getState().node).toBe(2); // persisted value restored from the backend

    render(<App />);
    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  }, 10000);
});

describe("App auth gating", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.getState().logout();
    useAuthStore.setState({ authScreen: "login" });
  });

  it("boots to the Login screen when no profile is known on this TV, and signing up reaches the map", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText(/welcome back/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /make a new player/i }));

    await screen.findByText(/pick a silly name/i);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const { PIN_ICONS } = await import("@/components/EmojiPinKeypad");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    const { AVATARS, AVATAR_EMOJI } = await import("@/components/AvatarPicker");
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] }));
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "6-8" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "6-8" }));

    await screen.findByText(/save this code/i);
    await user.click(screen.getByRole("button", { name: /ok, got it/i }));

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  });

  it("shows the Profile Picker on a second boot and logs in with the cached avatar", async () => {
    const { addKnownProfile } = await import("@/lib/knownProfiles");
    const { mockBackend } = await import("@/services/mockBackend");
    mockBackend.reset();
    const { PIN_ICONS } = await import("@/components/EmojiPinKeypad");
    await mockBackend.signup({
      username: "SpeedyOtter",
      pin: [PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]],
      avatar: "avatar_cat",
      age_band: "6-8",
    });
    addKnownProfile({ profileId: "known-1", username: "SpeedyOtter", avatar: "avatar_cat" });
    useAuthStore.setState({ authScreen: "profilePicker" });

    const user = userEvent.setup();
    render(<App />);

    const { avatarEmoji } = await import("@/components/AvatarPicker");
    await screen.findByText(/who's playing/i);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());
  });
});
