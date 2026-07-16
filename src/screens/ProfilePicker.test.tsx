import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfilePicker } from "./ProfilePicker";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { avatarEmoji } from "@/components/AvatarPicker";
import { addKnownProfile } from "@/lib/knownProfiles";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(async () => {
  window.localStorage.clear();
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("profilePicker");
  await mockBackend.signup({
    username: "SpeedyOtter",
    pin: [PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]],
    avatar: "avatar_cat",
    age_band: "6-8",
  });
  addKnownProfile({ profileId: "known-1", username: "SpeedyOtter", avatar: "avatar_cat" });
});

describe("ProfilePicker", () => {
  it("renders a focusable avatar button per known profile", () => {
    render(<ProfilePicker />);
    expect(screen.getByRole("button", { name: avatarEmoji("avatar_cat") })).toBeInTheDocument();
  });

  it("reveals the PIN pad after picking a profile, and logs in on the correct PIN", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    await waitFor(() => expect(useAuthStore.getState().authScreen).toBeNull());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("shows an error on the wrong PIN without completing the auth flow", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: avatarEmoji("avatar_cat") }));
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/invalid username or pin/i)).toBeInTheDocument();
    expect(useAuthStore.getState().authScreen).toBe("profilePicker");
  });

  it("'Use a different name' falls through to the full Login screen", async () => {
    const user = userEvent.setup();
    render(<ProfilePicker />);
    await user.click(screen.getByRole("button", { name: /use a different name/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });
});
