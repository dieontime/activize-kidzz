import { useEffect, useState } from "react";
import { createContentLoader } from "./loader";
import { useProgressStore } from "@/store/progressStore";
import type { World, Mission, Activity, Badge } from "./types";

const baseUrl = import.meta.env.VITE_CONTENT_URL ?? "/content";

export interface ContentState {
  status: "loading" | "ready" | "error";
  world: World | null;
  missions: Mission[];
  activitiesByMission: Record<string, Activity[]>;
  badges: Badge[];
  retry: () => void;
}

export function useContent(): ContentState {
  const [state, setState] = useState<Omit<ContentState, "retry">>({
    status: "loading",
    world: null,
    missions: [],
    activitiesByMission: {},
    badges: [],
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: "loading" }));
    const loader = createContentLoader({ baseUrl, storage: window.localStorage });
    (async () => {
      try {
        const manifest = await loader.loadManifest();
        const worldIndex = useProgressStore.getState().world;
        const worldId = manifest.worldIds[worldIndex] ?? manifest.worldIds[0];
        const world = await loader.loadWorld(worldId);
        const missions = await Promise.all(world.missionIds.map((id) => loader.loadMission(id)));
        const activitiesByMission: Record<string, Activity[]> = {};
        for (const mission of missions) {
          activitiesByMission[mission.id] = await Promise.all(mission.activityIds.map((id) => loader.loadActivity(id)));
        }
        const badges = await Promise.all(manifest.badgeIds.map((id) => loader.loadBadge(id)));
        if (!cancelled) setState({ status: "ready", world, missions, activitiesByMission, badges });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
