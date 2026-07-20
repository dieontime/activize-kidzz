import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_PROGRESS, type ProgressRecord } from "./progressTypes";

export type { ProgressRecord };

let _client: SupabaseClient | null = null;

function client(): SupabaseClient {
  if (_client) return _client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("supabaseProgressBackend: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
  }
  _client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  return _client;
}

export const supabaseProgressBackend = {
  async loadProgress(profileId: string): Promise<ProgressRecord> {
    const { data, error } = await client()
      .from("progress")
      .select("world, node, streak_count, longest_streak, last_completed_date, total_missions_completed")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_PROGRESS };
    return {
      world: data.world,
      node: data.node,
      streakCount: data.streak_count,
      longestStreak: data.longest_streak,
      lastCompletedDate: data.last_completed_date,
      totalMissionsCompleted: data.total_missions_completed,
    };
  },

  async saveProgress(profileId: string, record: ProgressRecord): Promise<void> {
    const { error } = await client().from("progress").upsert({
      profile_id: profileId,
      world: record.world,
      node: record.node,
      streak_count: record.streakCount,
      longest_streak: record.longestStreak,
      last_completed_date: record.lastCompletedDate,
      total_missions_completed: record.totalMissionsCompleted,
    });
    if (error) throw new Error(error.message);
  },

  async insertCompletion(profileId: string, missionId: string, activitiesDone: number): Promise<void> {
    const { error } = await client().from("mission_completions").insert({
      profile_id: profileId,
      mission_id: missionId,
      activities_done: activitiesDone,
    });
    if (error) throw new Error(error.message);
  },

  async insertEarnedBadge(profileId: string, badgeId: string): Promise<void> {
    const { error } = await client().from("earned_badges").insert({
      profile_id: profileId,
      badge_id: badgeId,
    });
    if (error) throw new Error(error.message);
  },

  async loadEarnedBadges(profileId: string): Promise<string[]> {
    const { data, error } = await client()
      .from("earned_badges")
      .select("badge_id")
      .eq("profile_id", profileId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.badge_id as string);
  },
};
