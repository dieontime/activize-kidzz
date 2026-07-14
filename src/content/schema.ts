import { z } from "zod";
import type { Manifest, World, Mission, Activity } from "./types";

const ageBand = z.enum(["3-5", "6-8"]);
const renderer = z.enum(["rive", "lottie", "video", "react"]);

const manifestSchema = z.object({
  version: z.number(),
  worldIds: z.array(z.string()),
  badgeIds: z.array(z.string()),
});

const worldSchema = z.object({
  id: z.string(),
  order: z.number(),
  theme: z.string(),
  name: z.string(),
  missionIds: z.array(z.string()),
  art: z.string(),
});

const missionSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  node: z.number(),
  title: z.string(),
  activityIds: z.array(z.string()),
});

const activityBase = { id: z.string(), title: z.string(), ageBands: z.array(ageBand), narration: z.string(), interstitial: z.boolean().optional() };

const activitySchema = z.discriminatedUnion("type", [
  z.object({ ...activityBase, type: z.literal("movement"), renderer, asset: z.string(), pacing: z.object({ reps: z.number(), tempoMs: z.number() }), instructions: z.string() }),
  z.object({ ...activityBase, type: z.literal("puzzle"), puzzleType: z.string(), data: z.record(z.unknown()) }),
  z.object({ ...activityBase, type: z.literal("breathing"), renderer, asset: z.string(), cycles: z.number() }),
]);

export const parseManifest = (json: unknown): Manifest => manifestSchema.parse(json);
export const parseWorld = (json: unknown): World => worldSchema.parse(json);
export const parseMission = (json: unknown): Mission => missionSchema.parse(json);
export const parseActivity = (json: unknown): Activity => activitySchema.parse(json) as Activity;
