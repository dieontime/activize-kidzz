import { evaluateBadgeRule, type BadgeEvalContext } from "./badgeRuleRegistry";
import { DEFAULT_PROGRESS } from "@/services/progressTypes";

function ctx(progressOverrides: Partial<BadgeEvalContext["progress"]> = {}): BadgeEvalContext {
  return {
    progress: { ...DEFAULT_PROGRESS, ...progressOverrides },
    worldId: "world-jungle",
    totalMissionsInWorld: 1,
  };
}

describe("evaluateBadgeRule", () => {
  describe("streak", () => {
    it("is false one below the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 2 }))).toBe(false);
    });
    it("is true at the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 3 }))).toBe(true);
    });
    it("is true above the threshold", () => {
      expect(evaluateBadgeRule({ kind: "streak", value: 3 }, ctx({ streakCount: 4 }))).toBe(true);
    });
  });

  describe("world_complete", () => {
    it("is false when the current world doesn't match the badge's worldId", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-desert" };
      expect(evaluateBadgeRule(rule, ctx({ node: 2 }))).toBe(false);
    });
    it("is false when node has not yet passed the world's mission count", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-jungle" };
      expect(evaluateBadgeRule(rule, ctx({ node: 1 }))).toBe(false);
    });
    it("is true once node passes the world's mission count", () => {
      const rule = { kind: "world_complete" as const, worldId: "world-jungle" };
      expect(evaluateBadgeRule(rule, ctx({ node: 2 }))).toBe(true);
    });
  });

  describe("missions_total", () => {
    it("is false one below the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 9 }))).toBe(false);
    });
    it("is true at the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 10 }))).toBe(true);
    });
    it("is true above the target", () => {
      expect(evaluateBadgeRule({ kind: "missions_total", value: 10 }, ctx({ totalMissionsCompleted: 11 }))).toBe(true);
    });
  });
});
