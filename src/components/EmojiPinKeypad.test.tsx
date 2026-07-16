import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmojiPinKeypad, PIN_ICONS } from "./EmojiPinKeypad";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";

beforeAll(() => initNavigation());

describe("EmojiPinKeypad", () => {
  it("renders all 12 emoji plus Clear and Done", () => {
    render(<EmojiPinKeypad onComplete={() => {}} />);
    for (const icon of PIN_ICONS) {
      expect(screen.getByRole("button", { name: icon })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /done/i })).toBeInTheDocument();
  });

  it("completes with the 4 tapped icons in order", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]]);
  });

  it("ignores a 5th tap once 4 icons are entered", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    for (let i = 0; i < 5; i++) await user.click(screen.getByRole("button", { name: PIN_ICONS[i % PIN_ICONS.length] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[0], PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3]]);
  });

  it("Clear resets the entered pin", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /clear/i }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[1] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[2] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[3] }));
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).toHaveBeenCalledWith([PIN_ICONS[1], PIN_ICONS[2], PIN_ICONS[3], PIN_ICONS[0]]);
  });

  it("Done does nothing until 4 icons are entered", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<EmojiPinKeypad onComplete={onComplete} />);
    await user.click(screen.getByRole("button", { name: PIN_ICONS[0] }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("puts D-pad focus on the first icon by default", async () => {
    render(<EmojiPinKeypad onComplete={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "true"));
  });

  it("ArrowRight moves D-pad focus to the geometrically-next icon in the grid", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.getAttribute?.("aria-label") ?? el.textContent;
      const index = PIN_ICONS.findIndex((icon) => icon === label);
      return index === -1 ? null : index;
    }, 4);

    render(<EmojiPinKeypad onComplete={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 39, code: "ArrowRight", key: "ArrowRight" });

    await waitFor(() => expect(screen.getByRole("button", { name: PIN_ICONS[1] })).toHaveAttribute("data-focused", "true"));
    expect(screen.getByRole("button", { name: PIN_ICONS[0] })).toHaveAttribute("data-focused", "false");

    restore();
  });
});
