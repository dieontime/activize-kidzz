export interface ProgressRecord {
  world: number;
  node: number;
  streakCount: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

// world is a 0-based index into manifest.worldIds; node is 1-based,
// matching the authored Mission.node ("Day N") numbering -- deliberately
// different bases, each chosen to match what it's compared against.
export const DEFAULT_PROGRESS: ProgressRecord = {
  world: 0,
  node: 1,
  streakCount: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};
