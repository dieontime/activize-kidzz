import { interstitialActivities } from "./interstitialActivities";

describe("interstitialActivities", () => {
  it("has at least 3 bundled activities", () => {
    expect(interstitialActivities.length).toBeGreaterThanOrEqual(3);
  });

  it("gives every activity a unique id", () => {
    const ids = interstitialActivities.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses renderer kinds the registry actually handles", () => {
    const validRenderers = ["rive", "lottie", "video", "react"];
    for (const activity of interstitialActivities) {
      expect(validRenderers).toContain(activity.renderer);
    }
  });

  it("only uses movement or breathing types", () => {
    for (const activity of interstitialActivities) {
      expect(["movement", "breathing"]).toContain(activity.type);
    }
  });
});
