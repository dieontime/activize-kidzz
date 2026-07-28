import { useEffect, useState } from "react";
import Lottie from "lottie-react";
import { PlaceholderRenderer } from "./PlaceholderRenderer";
import type { RendererProps } from "@/content/types";

export function LottieRenderer({ activity }: RendererProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAnimationData(null);
    setFailed(false);
    fetch(`/content/lottie/${activity.asset}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`bad status for ${activity.asset}`);
        return res.json();
      })
      .then(setAnimationData)
      .catch(() => setFailed(true));
  }, [activity]);

  if (failed) return <PlaceholderRenderer activity={activity} />;
  if (!animationData) return null;
  return <Lottie animationData={animationData} loop autoplay />;
}
