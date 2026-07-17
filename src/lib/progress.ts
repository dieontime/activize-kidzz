import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { todayDateString, yesterdayDateString } from "@/lib/date";
import type { ProgressRecord } from "@/services/progressTypes";

export async function loadProgress(profileId: string): Promise<void> {
  const record = await progressBackend.loadProgress(profileId);
  useProgressStore.getState().setProgress(record);
}

function nextStreakCount(lastCompletedDate: string | null, streakCount: number): number {
  const today = todayDateString();
  if (lastCompletedDate === today) return streakCount; // defensive -- the lock state should prevent this
  if (lastCompletedDate === yesterdayDateString()) return streakCount + 1;
  return 1;
}

export async function recordMissionCompletion(
  missionId: string,
  missionNode: number,
  activitiesDone: number,
): Promise<void> {
  try {
    const profileId = useAuthStore.getState().activeProfile?.id;
    if (!profileId) return;

    const current = useProgressStore.getState();
    if (missionNode !== current.node) return; // replay of an already-completed mission

    const streakCount = nextStreakCount(current.lastCompletedDate, current.streakCount);
    const updated: ProgressRecord = {
      world: current.world,
      node: current.node + 1,
      streakCount,
      longestStreak: Math.max(current.longestStreak, streakCount),
      lastCompletedDate: todayDateString(),
    };

    await progressBackend.saveProgress(profileId, updated);
    await progressBackend.insertCompletion(profileId, missionId, activitiesDone);
    useProgressStore.getState().setProgress(updated);
  } catch {
    // Best-effort persistence -- per spec ("no failure, no losing"), a
    // network blip must never block the reward moment. The caller does
    // not await this, by design.
  }
}
