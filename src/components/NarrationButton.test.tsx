import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { initNavigation } from "@/navigation/initNavigation";
import { NarrationButton } from "./NarrationButton";

describe("NarrationButton", () => {
  beforeAll(() => {
    initNavigation();
  });

  beforeEach(() => {
    vi.mocked(window.speechSynthesis.speak).mockReset();
    vi.mocked(window.speechSynthesis.cancel).mockReset();
  });

  it("speaks the given text when pressed", async () => {
    const user = userEvent.setup();
    render(<NarrationButton text="Let's do Cross Crawl!" />);
    await user.click(screen.getByRole("button", { name: /read it/i }));
    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(window.speechSynthesis.speak).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Let's do Cross Crawl!" }),
    );
  });

  it("cancels any in-progress speech before speaking again on a second press", async () => {
    const user = userEvent.setup();
    render(<NarrationButton text="Hello" />);
    const button = screen.getByRole("button", { name: /read it/i });
    await user.click(button);
    await user.click(button);
    expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(2);
  });

  it("renders nothing when speechSynthesis is unavailable", () => {
    const original = window.speechSynthesis;
    (window as { speechSynthesis?: SpeechSynthesis }).speechSynthesis = undefined;
    const { container } = render(<NarrationButton text="Hello" />);
    expect(container).toBeEmptyDOMElement();
    window.speechSynthesis = original;
  });
});
