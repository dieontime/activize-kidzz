export type MissionLockState = "completed" | "current" | "locked";

export function missionLockState(
  missionNode: number,
  progressNode: number,
  lastCompletedDate: string | null,
  today: string,
): MissionLockState {
  if (missionNode < progressNode) return "completed";
  if (missionNode === progressNode) return lastCompletedDate === today ? "locked" : "current";
  return "locked";
}
