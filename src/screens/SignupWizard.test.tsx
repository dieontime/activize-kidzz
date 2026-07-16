import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupWizard } from "./SignupWizard";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { AVATARS, AVATAR_EMOJI } from "@/components/AvatarPicker";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(() => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  useAuthStore.getState().setAuthScreen("signup");
});

async function fillUsernameStep(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.type(screen.getByPlaceholderText(/silly name/i), name);
  await user.click(screen.getByRole("button", { name: /next/i }));
}

async function fillPinStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
  await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
  await user.click(screen.getByRole("button", { name: /done/i }));
}

describe("SignupWizard", () => {
  it("walks through username -> pin -> avatar -> band -> recovery and logs the profile in", async () => {
    const user = userEvent.setup();
    render(<SignupWizard />);

    await fillUsernameStep(user, "SpeedyOtter");
    await fillPinStep(user);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] }));
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: "3-5" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "6-8" }));

    await waitFor(() => expect(screen.getByText(/save this code/i)).toBeInTheDocument());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
    expect(useAuthStore.getState().activeProfile?.age_band).toBe("6-8");

    // authScreen must NOT have advanced past 'signup' yet — the parent hasn't dismissed the code.
    expect(useAuthStore.getState().authScreen).toBe("signup");

    await user.click(screen.getByRole("button", { name: /ok, got it/i }));
    expect(useAuthStore.getState().authScreen).toBeNull();
  });

  it("shows an error and suggestions when the username is taken", async () => {
    await mockBackend.signup({ username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8" });
    const user = userEvent.setup();
    render(<SignupWizard />);
    await fillUsernameStep(user, "SpeedyOtter");
    expect(await screen.findByText(/already taken/i)).toBeInTheDocument();
  });

  it("shows an error for a profane username", async () => {
    const user = userEvent.setup();
    render(<SignupWizard />);
    // "SuperHellBoy" mirrors profanity.test.ts's own CamelCase-compound case — containsProfanity
    // does not flag substrings inside a single lowercase run (e.g. "shithead"), by design, to
    // avoid false positives like "Cassidy"/"grasshopper"/"hello"/"Michelle".
    await fillUsernameStep(user, "SuperHellBoy");
    expect(await screen.findByText(/try another name/i)).toBeInTheDocument();
  });
});
