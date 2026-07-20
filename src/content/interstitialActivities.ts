import type { MovementActivity, BreathingActivity } from "./types";

// Bundled directly in code (not CDN-fetched) -- this content must be
// available before any content fetch resolves (it covers the
// content-fetch async gate itself) and during auth screens, which render
// before useContent ever mounts.
export const interstitialActivities: (MovementActivity | BreathingActivity)[] = [
  {
    id: "interstitial-follow-dot",
    type: "movement",
    title: "Follow the Dot",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "follow-dot",
    pacing: { reps: 1, tempoMs: 1000 },
    instructions: "Follow the dot with your eyes!",
  },
  {
    id: "interstitial-palm-switch",
    type: "movement",
    title: "Palm Switches",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "palm-switch",
    pacing: { reps: 1, tempoMs: 1000 },
    instructions: "Switch your palms up and down!",
  },
  {
    id: "interstitial-belly-breath",
    type: "breathing",
    title: "Belly Breaths",
    ageBands: ["3-5", "6-8"],
    narration: "",
    renderer: "react",
    asset: "belly-breath",
    cycles: 1,
  },
];
