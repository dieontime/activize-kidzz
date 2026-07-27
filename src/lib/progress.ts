import { progressBackend } from "@/services/progressBackend";
import { useProgressStore } from "@/store/progressStore";
import { useAuthStore } from "@/store/authStore";
import { todayDateString, yesterdayDateString } from "@/lib/date";
import type { ProgressRecord } from "@/services/progressTypes";

interface PendingWrite {
  updated: ProgressRecord;
  missionId: string;
  activitiesDone: number;
}

function queueKey(profileId: string): string {
  return `activize:pendingProgress:${profileId}`;
}

function readQueue(profileId: string): PendingWrite[] {
  try {
    const raw = localStorage.getItem(queueKey(profileId));
    return raw ? (JSON.parse(raw) as PendingWrite[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(profileId: string, queue: PendingWrite[]): void {
  localStorage.setItem(queueKey(profileId), JSON.stringify(queue));
}

export async function retryQueuedWrites(profileId: string): Promise<void> {
  const remaining = readQueue(profileId);
  while (remaining.length > 0) {
    const next = remaining[0];
    try {
      await progressBackend.saveProgress(profileId, next.updated);
      await progressBackend.insertCompletion(profileId, next.missionId, next.activitiesDone);
      remaining.shift();
    } catch {
      break; // still offline -- try again next launch
    }
  }
  writeQueue(profileId, remaining);
}

export async function loadProgress(profileId: string): Promise<void> {
  await retryQueuedWrites(profileId);
  const [record, earnedBadgeIds] = await Promise.all([
    progressBackend.loadProgress(profileId),
    progressBackend.loadEarnedBadges(profileId),
  ]);
  useProgressStore.getState().setProgress(record);
  useProgressStore.getState().setEarnedBadgeIds(earnedBadgeIds);
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
    totalMissionsCompleted: current.totalMissionsCompleted + 1,
  };

  try {
    await progressBackend.saveProgress(profileId, updated);
    await progressBackend.insertCompletion(profileId, missionId, activitiesDone);
    useProgressStore.getState().setProgress(updated);
  } catch {
    // Write failed (e.g. network blip) -- queue for retry on next launch
    // instead of losing it forever. The reward screen is already optimistic
    // (shown regardless of write success), so this stays fully invisible to
    // the kid; see retryQueuedWrites, called from loadProgress above.
    const queue = readQueue(profileId);
    queue.push({ updated, missionId, activitiesDone });
    writeQueue(profileId, queue);
  }
}
