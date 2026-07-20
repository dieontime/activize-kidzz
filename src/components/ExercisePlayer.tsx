import { useEffect, useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { rendererRegistry } from "@/content/rendererRegistry";
import type { MovementActivity, BreathingActivity } from "@/content/types";

export const BREATH_CYCLE_MS = 4000;

interface Props {
  activity: MovementActivity | BreathingActivity;
  onValidated: () => void;
}

function gateDurationMs(activity: MovementActivity | BreathingActivity): number {
  if (activity.type === "movement") return activity.pacing.reps * activity.pacing.tempoMs;
  return activity.cycles * BREATH_CYCLE_MS;
}

export function ExercisePlayer({ activity, onValidated }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setReady(true), gateDurationMs(activity));
    return () => clearTimeout(timer);
  }, [activity]);

  const Renderer = rendererRegistry[activity.renderer];

  return (
    <>
      <div className="bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-6 mb-6">
        <Renderer activity={activity} />
      </div>
      <FocusableButton
        variant="pill"
        className="bg-storybook-peach text-storybook-peachText"
        autoFocus
        disabled={!ready}
        onPress={onValidated}
      >
        We did it!
      </FocusableButton>
    </>
  );
}
