import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";
import { LottieRenderer } from "@/components/renderers/LottieRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps video to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
  });

  it("maps rive to RiveRenderer", () => {
    expect(rendererRegistry.rive).toBe(RiveRenderer);
  });

  it("maps lottie to LottieRenderer", () => {
    expect(rendererRegistry.lottie).toBe(LottieRenderer);
  });
});
