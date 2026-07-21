import { z } from "zod";
import type { Manifest, World, Mission, Activity, Badge } from "./types";

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

const sequenceMemoryDataSchema = z
  .object({
    puzzleType: z.literal("sequence_memory"),
    icons: z.array(z.string()),
    sequence: z.array(z.string()),
  })
  .refine((data) => data.sequence.every((s) => data.icons.includes(s)), {
    message: "every sequence value must exist in icons",
  })
  .refine((data) => new Set(data.icons).size === data.icons.length, {
    message: "icons must not contain duplicates",
  });

// Only one puzzle kind exists so far -- this becomes a real
// z.discriminatedUnion("puzzleType", [...]) once a second kind ships.
// z.discriminatedUnion's branches must stay plain ZodObjects; the
// cross-field .refine() checks above only compose post-union, not
// per-branch, so the union itself waits until there's more than one kind.
const puzzleDataSchema = sequenceMemoryDataSchema;

const activitySchema = z.discriminatedUnion("type", [
  z.object({ ...activityBase, type: z.literal("movement"), renderer, asset: z.string(), pacing: z.object({ reps: z.number(), tempoMs: z.number() }), instructions: z.string() }),
  z.object({ ...activityBase, type: z.literal("puzzle"), puzzle: puzzleDataSchema }),
  z.object({ ...activityBase, type: z.literal("breathing"), renderer, asset: z.string(), cycles: z.number() }),
]);

const badgeRuleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("streak"), value: z.number() }),
  z.object({ kind: z.literal("world_complete"), worldId: z.string() }),
  z.object({ kind: z.literal("missions_total"), value: z.number() }),
]);

const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  rule: badgeRuleSchema,
});

export const parseManifest = (json: unknown): Manifest => manifestSchema.parse(json);
export const parseWorld = (json: unknown): World => worldSchema.parse(json);
export const parseMission = (json: unknown): Mission => missionSchema.parse(json);
export const parseActivity = (json: unknown): Activity => activitySchema.parse(json) as Activity;
export const parseBadge = (json: unknown): Badge => badgeSchema.parse(json) as Badge;
