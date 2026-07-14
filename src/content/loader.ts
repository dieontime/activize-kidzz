import { parseManifest, parseWorld, parseMission, parseActivity } from "./schema";
import type { Manifest, World, Mission, Activity } from "./types";

export interface ContentLoaderDeps {
  baseUrl: string;
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem">;
}

export interface ContentLoader {
  loadManifest(): Promise<Manifest>;
  loadWorld(id: string): Promise<World>;
  loadMission(id: string): Promise<Mission>;
  loadActivity(id: string): Promise<Activity>;
}

const KEY = "activize:content:";

export function createContentLoader(deps: ContentLoaderDeps): ContentLoader {
  const fetchFn = deps.fetchFn ?? fetch;
  const memory = new Map<string, unknown>();

  async function load<T>(path: string, parse: (j: unknown) => T): Promise<T> {
    const cacheKey = KEY + path;
    try {
      const res = await fetchFn(`${deps.baseUrl}/${path}`);
      if (!("ok" in res) || !res.ok) throw new Error(`bad status for ${path}`);
      const value = parse(await res.json());
      memory.set(cacheKey, value);
      try {
        deps.storage?.setItem(cacheKey, JSON.stringify(value));
      } catch {
        /* persistence is best-effort */
      }
      return value;
    } catch (err) {
      if (memory.has(cacheKey)) return memory.get(cacheKey) as T;
      const stored = deps.storage?.getItem(cacheKey);
      if (stored) {
        try {
          return parse(JSON.parse(stored));
        } catch {
          /* corrupted cache — fall through */
        }
      }
      throw err;
    }
  }

  return {
    loadManifest: () => load("manifest.json", parseManifest),
    loadWorld: (id) => load(`worlds/${id}.json`, parseWorld),
    loadMission: (id) => load(`missions/${id}.json`, parseMission),
    loadActivity: (id) => load(`activities/${id}.json`, parseActivity),
  };
}
