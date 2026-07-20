import { DEFAULT_PROGRESS, type ProgressRecord } from "./progressTypes";

export type { ProgressRecord };
export { DEFAULT_PROGRESS };

interface StoredProgress {
  profile_id: string;
  world: number;
  node: number;
  streak_count: number;
  longest_streak: number;
  last_completed_date: string | null;
  total_missions_completed: number;
}

interface StoredCompletion {
  id: string;
  profile_id: string;
  mission_id: string;
  completed_at: string;
  activities_done: number;
}

interface StoredEarnedBadge {
  profile_id: string;
  badge_id: string;
  earned_at: string;
}

const KEY_PROGRESS = "mockProgressBackend.progress";
const KEY_COMPLETIONS = "mockProgressBackend.completions";
const KEY_BADGES = "mockProgressBackend.earnedBadges";

function readKey<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeKey<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

function toRecord(row: StoredProgress): ProgressRecord {
  return {
    world: row.world,
    node: row.node,
    streakCount: row.streak_count,
    longestStreak: row.longest_streak,
    lastCompletedDate: row.last_completed_date,
    totalMissionsCompleted: row.total_missions_completed,
  };
}

export const mockProgressBackend = {
  reset(): void {
    localStorage.removeItem(KEY_PROGRESS);
    localStorage.removeItem(KEY_COMPLETIONS);
    localStorage.removeItem(KEY_BADGES);
  },

  async loadProgress(profileId: string): Promise<ProgressRecord> {
    const rows = readKey<StoredProgress>(KEY_PROGRESS);
    const row = rows.find((r) => r.profile_id === profileId);
    return row ? toRecord(row) : { ...DEFAULT_PROGRESS };
  },

  async saveProgress(profileId: string, record: ProgressRecord): Promise<void> {
    const rows = readKey<StoredProgress>(KEY_PROGRESS);
    const idx = rows.findIndex((r) => r.profile_id === profileId);
    const stored: StoredProgress = {
      profile_id: profileId,
      world: record.world,
      node: record.node,
      streak_count: record.streakCount,
      longest_streak: record.longestStreak,
      last_completed_date: record.lastCompletedDate,
      total_missions_completed: record.totalMissionsCompleted,
    };
    if (idx === -1) rows.push(stored);
    else rows[idx] = stored;
    writeKey(KEY_PROGRESS, rows);
  },

  async insertCompletion(profileId: string, missionId: string, activitiesDone: number): Promise<void> {
    const rows = readKey<StoredCompletion>(KEY_COMPLETIONS);
    rows.push({
      id: crypto.randomUUID(),
      profile_id: profileId,
      mission_id: missionId,
      completed_at: new Date().toISOString(),
      activities_done: activitiesDone,
    });
    writeKey(KEY_COMPLETIONS, rows);
  },

  async insertEarnedBadge(profileId: string, badgeId: string): Promise<void> {
    const rows = readKey<StoredEarnedBadge>(KEY_BADGES);
    rows.push({ profile_id: profileId, badge_id: badgeId, earned_at: new Date().toISOString() });
    writeKey(KEY_BADGES, rows);
  },

  async loadEarnedBadges(profileId: string): Promise<string[]> {
    const rows = readKey<StoredEarnedBadge>(KEY_BADGES);
    return rows.filter((r) => r.profile_id === profileId).map((r) => r.badge_id);
  },
};
