import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvatarPicker, AVATARS, AVATAR_EMOJI, avatarEmoji } from "./AvatarPicker";
import { initNavigation } from "@/navigation/initNavigation";
import { mockGridLayout } from "@/testUtils/mockGridLayout";

beforeAll(() => initNavigation());

describe("AvatarPicker", () => {
  it("renders all 12 avatars", () => {
    render(<AvatarPicker onPick={() => {}} />);
    for (const id of AVATARS) {
      expect(screen.getByRole("button", { name: AVATAR_EMOJI[id] })).toBeInTheDocument();
    }
  });

  it("calls onPick with the chosen avatar id", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<AvatarPicker onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[2]] }));
    expect(onPick).toHaveBeenCalledWith(AVATARS[2]);
  });

  it("puts D-pad focus on the first avatar by default", async () => {
    render(<AvatarPicker onPick={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toHaveAttribute("data-focused", "true"));
  });

  it("ArrowDown moves D-pad focus to the avatar directly below in the grid", async () => {
    const restore = mockGridLayout((el) => {
      const label = el.textContent;
      const index = AVATARS.findIndex((id) => AVATAR_EMOJI[id] === label);
      return index === -1 ? null : index;
    }, 4);

    render(<AvatarPicker onPick={() => {}} />);
    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[0]] })).toHaveAttribute("data-focused", "true"));

    fireEvent.keyDown(window, { keyCode: 40, code: "ArrowDown", key: "ArrowDown" });

    await waitFor(() => expect(screen.getByRole("button", { name: AVATAR_EMOJI[AVATARS[4]] })).toHaveAttribute("data-focused", "true"));

    restore();
  });
});

describe("avatarEmoji", () => {
  it("returns the emoji for a known avatar id", () => {
    expect(avatarEmoji(AVATARS[0])).toBe(AVATAR_EMOJI[AVATARS[0]]);
  });

  it("returns a placeholder for null/undefined/unknown", () => {
    expect(avatarEmoji(null)).toBe("👤");
    expect(avatarEmoji(undefined)).toBe("👤");
    expect(avatarEmoji("not-a-real-avatar")).toBe("👤");
  });
});
