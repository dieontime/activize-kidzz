import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps lottie, video, and rive to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.lottie).toBe(PlaceholderRenderer);
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
    expect(rendererRegistry.rive).toBe(PlaceholderRenderer);
  });
});
