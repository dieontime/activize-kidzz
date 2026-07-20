import type { BadgeRule } from "./types";
import type { ProgressRecord } from "@/services/progressTypes";

export interface BadgeEvalContext {
  progress: ProgressRecord;
  worldId: string;
  totalMissionsInWorld: number;
}

type BadgeRuleRegistry = {
  [K in BadgeRule["kind"]]: (rule: Extract<BadgeRule, { kind: K }>, ctx: BadgeEvalContext) => boolean;
};

export const badgeRuleRegistry: BadgeRuleRegistry = {
  streak: (rule, ctx) => ctx.progress.streakCount >= rule.value,
  world_complete: (rule, ctx) => rule.worldId === ctx.worldId && ctx.progress.node > ctx.totalMissionsInWorld,
  missions_total: (rule, ctx) => ctx.progress.totalMissionsCompleted >= rule.value,
};

export function evaluateBadgeRule(rule: BadgeRule, ctx: BadgeEvalContext): boolean {
  const evaluator = badgeRuleRegistry[rule.kind] as (rule: BadgeRule, ctx: BadgeEvalContext) => boolean;
  return evaluator(rule, ctx);
}
