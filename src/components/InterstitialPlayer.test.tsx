import { render, screen, waitFor } from "@testing-library/react";
import { InterstitialPlayer } from "./InterstitialPlayer";
import { useInterstitialStore } from "@/store/interstitialStore";

describe("InterstitialPlayer", () => {
  afterEach(() => useInterstitialStore.getState().reset());

  it("renders nothing while not pending", () => {
    render(<InterstitialPlayer />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a loading overlay once pending outlasts the default delay", async () => {
    render(<InterstitialPlayer />);
    useInterstitialStore.getState().setPending(true);
    await waitFor(() => expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument(), { timeout: 1000 });
  });

  it("shows a Ready! flash after pending resolves, then hides", async () => {
    render(<InterstitialPlayer />);
    useInterstitialStore.getState().setPending(true);
    await waitFor(() => expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument(), { timeout: 1000 });
    useInterstitialStore.getState().setPending(false);
    await waitFor(() => expect(screen.getByRole("status", { name: /ready/i })).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument(), { timeout: 1000 });
  }, 10000);
});
