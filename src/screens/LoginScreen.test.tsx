import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginScreen } from "./LoginScreen";
import { PIN_ICONS } from "@/components/EmojiPinKeypad";
import { useAuthStore } from "@/store/authStore";
import { mockBackend } from "@/services/mockBackend";
import { initNavigation } from "@/navigation/initNavigation";

beforeAll(() => initNavigation());
beforeEach(async () => {
  mockBackend.reset();
  useAuthStore.getState().logout();
  await mockBackend.signup({
    username: "SpeedyOtter",
    pin: [PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]],
    avatar: "avatar_cat",
    age_band: "6-8",
  });
});

describe("LoginScreen", () => {
  it("does not show the PIN pad until at least 3 characters are typed", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    expect(screen.queryByRole("button", { name: PIN_ICONS[0] })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/silly name/i), "Sp");
    expect(screen.queryByRole("button", { name: PIN_ICONS[0] })).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/silly name/i), "e");
    expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toBeInTheDocument();
  });

  it("logs in with the correct username and PIN, completing the auth flow", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(useAuthStore.getState().authScreen).toBeNull());
    expect(useAuthStore.getState().activeProfile?.username).toBe("SpeedyOtter");
  });

  it("shows an error on the wrong PIN and does not complete the auth flow", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.type(screen.getByPlaceholderText(/silly name/i), "SpeedyOtter");
    await user.click(screen.getByRole("button", { name: PIN_ICONS[4] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[5] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[6] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[7] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(await screen.findByText(/invalid username or pin/i)).toBeInTheDocument();
    expect(useAuthStore.getState().authScreen).toBe("login");
  });

  it("'Make a new player' navigates to signup", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole("button", { name: /make a new player/i }));
    expect(useAuthStore.getState().authScreen).toBe("signup");
  });

  it("'Forgot PIN?' navigates to recovery", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByRole("button", { name: /forgot pin/i }));
    expect(useAuthStore.getState().authScreen).toBe("recovery");
  });
});
