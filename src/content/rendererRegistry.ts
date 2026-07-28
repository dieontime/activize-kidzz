import type { ComponentType } from "react";
import { ReactRenderer } from "@/components/renderers/ReactRenderer";
import { PlaceholderRenderer } from "@/components/renderers/PlaceholderRenderer";
import { RiveRenderer } from "@/components/renderers/RiveRenderer";
import { LottieRenderer } from "@/components/renderers/LottieRenderer";
import type { Renderer, RendererProps } from "./types";

export const rendererRegistry: Record<Renderer, ComponentType<RendererProps>> = {
  react: ReactRenderer,
  lottie: LottieRenderer,
  video: PlaceholderRenderer,
  rive: RiveRenderer,
};
