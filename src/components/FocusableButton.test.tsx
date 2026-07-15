import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FocusableButton } from "./FocusableButton";

describe("FocusableButton", () => {
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
});
