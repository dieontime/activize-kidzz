import { useState } from "react";
import { useRive } from "@rive-app/react-canvas";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { RendererProps } from "@/content/types";

export function RiveRenderer({ activity }: RendererProps) {
  const [failed, setFailed] = useState(false);
  const { RiveComponent } = useRive({
    src: `/content/rive/${activity.asset}.riv`,
    autoplay: true,
    onLoadError: () => setFailed(true),
  });

  if (failed) return <PlaceholderRenderer activity={activity} />;
  return <RiveComponent />;
}
