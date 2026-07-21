import { rendererRegistry } from "./rendererRegistry";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";

describe("rendererRegistry", () => {
  it("maps react to ReactRenderer", () => {
    expect(rendererRegistry.react).toBe(ReactRenderer);
  });

  it("maps lottie and video to the shared PlaceholderRenderer", () => {
    expect(rendererRegistry.lottie).toBe(PlaceholderRenderer);
    expect(rendererRegistry.video).toBe(PlaceholderRenderer);
  });

  it("maps rive to RiveRenderer", () => {
    expect(rendererRegistry.rive).toBe(RiveRenderer);
  });
});
