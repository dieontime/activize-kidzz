import { useInterstitialStore } from "./interstitialStore";

describe("useInterstitialStore", () => {
  afterEach(() => useInterstitialStore.getState().reset());

  it("starts with pending false", () => {
    expect(useInterstitialStore.getState().pending).toBe(false);
  });

  it("setPending updates the flag", () => {
    useInterstitialStore.getState().setPending(true);
    expect(useInterstitialStore.getState().pending).toBe(true);
  });

  it("reset returns pending to false", () => {
    useInterstitialStore.getState().setPending(true);
    useInterstitialStore.getState().reset();
    expect(useInterstitialStore.getState().pending).toBe(false);
  });
});
