export type AgeBand = "3-5" | "6-8";
export type Renderer = "rive" | "lottie" | "video" | "react";

export interface Manifest {
  version: number;
  worldIds: string[];
  badgeIds: string[];
}

export interface World {
  id: string;
  order: number;
  theme: string;
  name: string;
  missionIds: string[];
  art: string;
}

export interface Mission {
  id: string;
  worldId: string;
  node: number;
  title: string;
  activityIds: string[];
}

interface ActivityBase {
  id: string;
  title: string;
  ageBands: AgeBand[];
  narration: string;
  interstitial?: boolean;
}

export interface MovementActivity extends ActivityBase {
  type: "movement";
  renderer: Renderer;
  asset: string;
  pacing: { reps: number; tempoMs: number };
  instructions: string;
}

export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzle: PuzzleData;
}

export type PuzzleData =
  | { puzzleType: "sequence_memory"; icons: string[]; sequence: string[] };

export interface BreathingActivity extends ActivityBase {
  type: "breathing";
  renderer: Renderer;
  asset: string;
  cycles: number;
}

export type Activity = MovementActivity | PuzzleActivity | BreathingActivity;

export interface RendererProps {
  activity: MovementActivity | BreathingActivity;
}

export type BadgeRule =
  | { kind: "streak"; value: number }
  | { kind: "world_complete"; worldId: string }
  | { kind: "missions_total"; value: number };

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  rule: BadgeRule;
}
