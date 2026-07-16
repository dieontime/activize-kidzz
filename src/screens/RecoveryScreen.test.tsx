import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecoveryScreen } from "./RecoveryScreen";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());

describe("RecoveryScreen", () => {
  let recoveryCode: string;

  beforeEach(async () => {
    mockBackend.reset();
    useAuthStore.getState().logout();
    useAuthStore.getState().setAuthScreen("recovery");
    const result = await mockBackend.signup({
      username: "SpeedyOtter", pin: ["🐱", "⚡", "🍕", "🌈"], avatar: "avatar_cat", age_band: "6-8",
    });
    recoveryCode = result.recoveryCode;
  });

  it("resets the PIN with the correct username and recovery code, then shows a new code", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.type(screen.getByPlaceholderText(/recovery code/i), recoveryCode);
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/all set/i)).toBeInTheDocument();
    expect(useAuthStore.getState().activeProfile).toBeNull();

    await user.click(screen.getByRole("button", { name: /ok, log in/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });

  it("shows an error and returns to the credentials step on a wrong recovery code", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.type(screen.getByPlaceholderText(/recovery code/i), "WRONG-CODE-0000");
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));

    expect(await screen.findByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/silly name/i)).toBeInTheDocument();
  });

  it("'Back to login' returns to the login screen without recovering", async () => {
    const user = userEvent.setup();
    render(<RecoveryScreen />);
    await user.click(screen.getByRole("button", { name: /back to login/i }));
    expect(useAuthStore.getState().authScreen).toBe("login");
  });
});
