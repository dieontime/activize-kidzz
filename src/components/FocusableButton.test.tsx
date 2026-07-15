import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { FocusableButton } from "./FocusableButton";

describe("FocusableButton", () => {
  beforeAll(() => {
    initNavigation();
  });

  it("calls onPress when activated", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<FocusableButton onPress={onPress}>Start</FocusableButton>);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders its label", () => {
    render(<FocusableButton onPress={() => {}}>Play Now</FocusableButton>);
    expect(screen.getByRole("button", { name: /play now/i })).toBeInTheDocument();
  });

  it("acquires focus when autoFocus is set", async () => {
    render(
      <FocusableButton autoFocus onPress={() => {}}>
        Continue
      </FocusableButton>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continue/i })).toHaveAttribute(
        "data-focused",
        "true",
      ),
    );
  });

  it("calls onPress when Enter is pressed while focused", async () => {
    const onPress = vi.fn();
    render(
      <FocusableButton autoFocus onPress={onPress}>
        Resume
      </FocusableButton>,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /resume/i })).toHaveAttribute(
        "data-focused",
        "true",
      ),
    );

    fireEvent.keyDown(window, { keyCode: 13, code: "Enter", key: "Enter" });

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
