import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { evaluateBadgeRule } from "@/content/badgeRuleRegistry";
import type { Badge } from "@/content/types";

interface AwardContext {
  worldId: string;
  totalMissionsInWorld: number;
}

export async function evaluateAndAwardBadges(badges: Badge[], ctx: AwardContext): Promise<Badge[]> {
  try {
    const profileId = useAuthStore.getState().activeProfile?.id;
    if (!profileId) return [];

    const progress = useProgressStore.getState();
    const newly = badges.filter(
      (b) => !progress.earnedBadgeIds.includes(b.id) && evaluateBadgeRule(b.rule, { ...ctx, progress }),
    );

    for (const b of newly) {
      await progressBackend.insertEarnedBadge(profileId, b.id);
    }

    useProgressStore.getState().awardBadges(newly.map((b) => b.id));
    return newly;
  } catch {
    // Same resilience contract as recordMissionCompletion: never throw to a
    // fire-and-forget caller. A missed badge write self-heals next
    // completion (earnedBadgeIds is re-checked from scratch each time).
    return [];
  }
}
