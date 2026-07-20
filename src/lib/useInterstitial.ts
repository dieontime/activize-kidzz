import { useEffect, useState } from "react";
import { interstitialActivities } from "@/content/interstitialActivities";
import type { MovementActivity, BreathingActivity } from "@/content/types";

export type InterstitialResult =
  | { state: "hidden" }
  | { state: "showing"; activity: MovementActivity | BreathingActivity }
  | { state: "ready" };

function pickRandomActivity(): MovementActivity | BreathingActivity {
  return interstitialActivities[Math.floor(Math.random() * interstitialActivities.length)];
}

export function useInterstitial(
  pending: boolean,
  opts?: { delayMs?: number; readyFlashMs?: number },
): InterstitialResult {
  const delayMs = opts?.delayMs ?? 300;
  const readyFlashMs = opts?.readyFlashMs ?? 400;
  const [state, setState] = useState<"hidden" | "showing" | "ready">("hidden");
  const [activity, setActivity] = useState<MovementActivity | BreathingActivity | null>(null);

  useEffect(() => {
    if (pending) {
      const timer = setTimeout(() => {
        setActivity(pickRandomActivity());
        setState("showing");
      }, delayMs);
      return () => clearTimeout(timer);
    }
    setState((current) => (current === "showing" ? "ready" : current));
  }, [pending, delayMs]);

  useEffect(() => {
    if (state !== "ready") return;
    const timer = setTimeout(() => setState("hidden"), readyFlashMs);
    return () => clearTimeout(timer);
  }, [state, readyFlashMs]);

  if (state === "showing") return { state, activity: activity as MovementActivity | BreathingActivity };
  if (state === "ready") return { state: "ready" };
  return { state: "hidden" };
}
