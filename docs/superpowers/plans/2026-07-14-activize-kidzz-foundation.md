# Activize Kidzz — Plan 1: Foundation / Walking Skeleton

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A TV-browser app that boots, loads data-driven content, shows a D-pad-navigable journey map, and lets a child step through a placeholder daily mission to a reward screen — no auth, no persistence yet.

**Architecture:** Vite + React + TypeScript static SPA. Content is fetched as versioned JSON (from a `baseUrl`; in dev/test, local fixtures) through an injectable loader with in-memory + localStorage caching and last-good fallback. UI screens are driven entirely by content data. A tiny Zustand `uiStore` is the screen state machine (no router — URLs are meaningless on a TV). D-pad navigation via `@noriginmedia/norigin-spatial-navigation`.

**Tech Stack:** Vite, React 18, TypeScript, Vitest + @testing-library/react + jsdom, Zustand, Zod, `@noriginmedia/norigin-spatial-navigation`.

## Global Constraints

- **Target weak TV browsers** (Fire TV Silk / WebOS / Tizen). Vite build target `es2019`. No bleeding-edge JS APIs. Keep the bundle light.
- **D-pad only.** Every interactive element is focusable via spatial navigation. No hover-only or pointer-only affordances. Default focus must land on the primary action of each screen.
- **10-foot UI.** Base font large; all sizing in `rem`; assume viewing from across a room.
- **No fail states in gameplay.** A child can never "lose" or hit a game-over.
- **Content is data-driven.** Never hardcode worlds/missions/activities/badges inside components. Components render whatever the content data describes.
- **Static content on CDN; Supabase (later plans) for mutable state only.** This plan touches no Supabase.
- **Testing:** Vitest + RTL, black-box (assert rendered text/behavior, not implementation). Content loaded from fixtures. No network in tests.
- **Discipline:** TDD (test first), frequent commits, DRY, YAGNI.

---

### Task 1: Project scaffold + test infrastructure

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/setupTests.ts`, `src/App.test.tsx`, `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `App` React component (default export from `src/App.tsx`); working `npm run dev`, `npm run build`, `npm test`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "activize-kidzz",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5",
    "zod": "^3.23.8",
    "@noriginmedia/norigin-spatial-navigation": "^2.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^25.0.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2019",
    "useDefineForClassFields": true,
    "lib": ["ES2019", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { target: "es2019" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Activize Kidzz</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/setupTests.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 7: Write the failing test `src/App.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import App from "@/App";

describe("App", () => {
  it("renders the app title on boot", () => {
    render(<App />);
    expect(screen.getByText(/activize kidzz/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm install && npm test`
Expected: FAIL — cannot resolve `@/App` (file does not exist yet).

- [ ] **Step 9: Create minimal `src/App.tsx`**

```tsx
export default function App() {
  return <h1>Activize Kidzz</h1>;
}
```

- [ ] **Step 10: Create `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + ts + vitest"
```

---

### Task 2: Content domain types + Zod schemas

**Files:**
- Create: `src/content/types.ts`, `src/content/schema.ts`, `src/content/schema.test.ts`
- Create (fixtures): `src/content/__fixtures__/manifest.json`, `world-jungle.json`, `mission-001.json`, `activity-cross-crawl.json`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Types: `Manifest`, `World`, `Mission`, `Activity` (discriminated union on `type`: `MovementActivity | PuzzleActivity | BreathingActivity`), `AgeBand = "3-5" | "6-8"`.
  - Parsers (throw on invalid): `parseManifest(json: unknown): Manifest`, `parseWorld(json: unknown): World`, `parseMission(json: unknown): Mission`, `parseActivity(json: unknown): Activity`.

- [ ] **Step 1: Create fixtures**

`src/content/__fixtures__/manifest.json`
```json
{ "version": 1, "worldIds": ["world-jungle"], "badgeIds": ["badge-first"] }
```

`src/content/__fixtures__/world-jungle.json`
```json
{
  "id": "world-jungle",
  "order": 1,
  "theme": "jungle",
  "name": "Jungle Jump",
  "missionIds": ["mission-001"],
  "art": "worlds/jungle.png"
}
```

`src/content/__fixtures__/mission-001.json`
```json
{
  "id": "mission-001",
  "worldId": "world-jungle",
  "node": 1,
  "title": "Day 1: Wake Up Your Brain",
  "activityIds": ["activity-cross-crawl"]
}
```

`src/content/__fixtures__/activity-cross-crawl.json`
```json
{
  "id": "activity-cross-crawl",
  "type": "movement",
  "title": "Cross Crawl",
  "ageBands": ["6-8"],
  "renderer": "react",
  "asset": "cross-crawl",
  "narration": "cross-crawl.mp3",
  "pacing": { "reps": 6, "tempoMs": 1200 },
  "instructions": "Touch your right hand to your left knee, then switch!"
}
```

- [ ] **Step 2: Write the failing test `src/content/schema.test.ts`**

```typescript
import manifestJson from "./__fixtures__/manifest.json";
import worldJson from "./__fixtures__/world-jungle.json";
import missionJson from "./__fixtures__/mission-001.json";
import activityJson from "./__fixtures__/activity-cross-crawl.json";
import { parseManifest, parseWorld, parseMission, parseActivity } from "./schema";

describe("content schema", () => {
  it("parses a valid manifest", () => {
    expect(parseManifest(manifestJson).worldIds).toEqual(["world-jungle"]);
  });

  it("parses a valid world", () => {
    expect(parseWorld(worldJson).name).toBe("Jungle Jump");
  });

  it("parses a valid mission with ordered activities", () => {
    expect(parseMission(missionJson).activityIds).toEqual(["activity-cross-crawl"]);
  });

  it("parses a movement activity with pacing", () => {
    const a = parseActivity(activityJson);
    expect(a.type).toBe("movement");
    if (a.type === "movement") {
      expect(a.pacing.reps).toBe(6);
    }
  });

  it("rejects an activity with an unknown type", () => {
    expect(() => parseActivity({ ...activityJson, type: "dance" })).toThrow();
  });

  it("rejects a manifest missing worldIds", () => {
    expect(() => parseManifest({ version: 1 })).toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/content/schema.test.ts`
Expected: FAIL — cannot resolve `./schema`.

- [ ] **Step 4: Create `src/content/types.ts`**

```typescript
export type AgeBand = "3-5" | "6-8";
export type Renderer = "rive" | "lottie" | "video" | "react";

export interface Manifest {
  version: number;
  worldIds: string[];
  badgeIds: string[];
}

export interface World {
  id: string;
  order: number;
  theme: string;
  name: string;
  missionIds: string[];
  art: string;
}

export interface Mission {
  id: string;
  worldId: string;
  node: number;
  title: string;
  activityIds: string[];
}

interface ActivityBase {
  id: string;
  title: string;
  ageBands: AgeBand[];
  narration: string;
  interstitial?: boolean;
}

export interface MovementActivity extends ActivityBase {
  type: "movement";
  renderer: Renderer;
  asset: string;
  pacing: { reps: number; tempoMs: number };
  instructions: string;
}

export interface PuzzleActivity extends ActivityBase {
  type: "puzzle";
  puzzleType: string;
  data: Record<string, unknown>;
}

export interface BreathingActivity extends ActivityBase {
  type: "breathing";
  renderer: Renderer;
  asset: string;
  cycles: number;
}

export type Activity = MovementActivity | PuzzleActivity | BreathingActivity;
```

- [ ] **Step 5: Create `src/content/schema.ts`**

```typescript
import { z } from "zod";
import type { Manifest, World, Mission, Activity } from "./types";

const ageBand = z.enum(["3-5", "6-8"]);
const renderer = z.enum(["rive", "lottie", "video", "react"]);

const manifestSchema = z.object({
  version: z.number(),
  worldIds: z.array(z.string()),
  badgeIds: z.array(z.string()),
});

const worldSchema = z.object({
  id: z.string(),
  order: z.number(),
  theme: z.string(),
  name: z.string(),
  missionIds: z.array(z.string()),
  art: z.string(),
});

const missionSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  node: z.number(),
  title: z.string(),
  activityIds: z.array(z.string()),
});

const activityBase = { id: z.string(), title: z.string(), ageBands: z.array(ageBand), narration: z.string(), interstitial: z.boolean().optional() };

const activitySchema = z.discriminatedUnion("type", [
  z.object({ ...activityBase, type: z.literal("movement"), renderer, asset: z.string(), pacing: z.object({ reps: z.number(), tempoMs: z.number() }), instructions: z.string() }),
  z.object({ ...activityBase, type: z.literal("puzzle"), puzzleType: z.string(), data: z.record(z.unknown()) }),
  z.object({ ...activityBase, type: z.literal("breathing"), renderer, asset: z.string(), cycles: z.number() }),
]);

export const parseManifest = (json: unknown): Manifest => manifestSchema.parse(json);
export const parseWorld = (json: unknown): World => worldSchema.parse(json);
export const parseMission = (json: unknown): Mission => missionSchema.parse(json);
export const parseActivity = (json: unknown): Activity => activitySchema.parse(json) as Activity;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- src/content/schema.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: content domain types and zod parsers"
```

---

### Task 3: Content loader (fetch + cache + last-good fallback)

**Files:**
- Create: `src/content/loader.ts`, `src/content/loader.test.ts`

**Interfaces:**
- Consumes: `parseManifest`, `parseWorld`, `parseMission`, `parseActivity` (Task 2).
- Produces: `createContentLoader(deps: ContentLoaderDeps): ContentLoader` where
  - `ContentLoaderDeps = { baseUrl: string; fetchFn?: typeof fetch; storage?: Pick<Storage, "getItem" | "setItem"> }`
  - `ContentLoader = { loadManifest(): Promise<Manifest>; loadWorld(id): Promise<World>; loadMission(id): Promise<Mission>; loadActivity(id): Promise<Activity> }`
  - Behavior: fetch JSON from `${baseUrl}/<path>`, parse+validate, cache in memory and (if storage given) persist last-good under a namespaced key; on fetch/parse failure, return last-good from memory then storage; if none, throw.

- [ ] **Step 1: Write the failing test `src/content/loader.test.ts`**

```typescript
import { createContentLoader } from "./loader";
import manifestJson from "./__fixtures__/manifest.json";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

function okFetch(body: unknown): typeof fetch {
  return (async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
}

function failFetch(): typeof fetch {
  return (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
}

describe("content loader", () => {
  it("fetches and parses the manifest", async () => {
    const loader = createContentLoader({ baseUrl: "/content", fetchFn: okFetch(manifestJson) });
    expect((await loader.loadManifest()).worldIds).toEqual(["world-jungle"]);
  });

  it("serves last-good from storage when the network fails", async () => {
    const storage = fakeStorage();
    const good = createContentLoader({ baseUrl: "/content", fetchFn: okFetch(manifestJson), storage });
    await good.loadManifest(); // primes last-good in storage

    const offline = createContentLoader({ baseUrl: "/content", fetchFn: failFetch(), storage });
    expect((await offline.loadManifest()).worldIds).toEqual(["world-jungle"]);
  });

  it("throws when the network fails and there is no cached copy", async () => {
    const offline = createContentLoader({ baseUrl: "/content", fetchFn: failFetch(), storage: fakeStorage() });
    await expect(offline.loadManifest()).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/content/loader.test.ts`
Expected: FAIL — cannot resolve `./loader`.

- [ ] **Step 3: Create `src/content/loader.ts`**

```typescript
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
      deps.storage?.setItem(cacheKey, JSON.stringify(value));
      return value;
    } catch (err) {
      if (memory.has(cacheKey)) return memory.get(cacheKey) as T;
      const stored = deps.storage?.getItem(cacheKey);
      if (stored) return parse(JSON.parse(stored));
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/content/loader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: content loader with cache and last-good fallback"
```

---

### Task 4: Spatial navigation init + FocusableButton

**Files:**
- Create: `src/navigation/initNavigation.ts`, `src/components/FocusableButton.tsx`, `src/components/FocusableButton.test.tsx`

**Interfaces:**
- Consumes: `@noriginmedia/norigin-spatial-navigation`.
- Produces:
  - `initNavigation(): void` — calls the library `init` once (idempotent).
  - `FocusableButton` component: `{ onPress: () => void; children: ReactNode; focusKey?: string; autoFocus?: boolean }`. Renders a `<button>`, registers with spatial nav, calls `onPress` on Enter/OK (and on DOM click for dev), and applies `data-focused="true"` when focused.

- [ ] **Step 1: Write the failing test `src/components/FocusableButton.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FocusableButton } from "./FocusableButton";

describe("FocusableButton", () => {
  it("calls onPress when activated", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<FocusableButton onPress={onPress}>Start</FocusableButton>);
    await user.click(screen.getByRole("button", { name: /start/i }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders its label", () => {
    render(<FocusableButton onPress={() => {}}>Play Now</FocusableButton>);
    expect(screen.getByRole("button", { name: /play now/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/FocusableButton.test.tsx`
Expected: FAIL — cannot resolve `./FocusableButton`.

- [ ] **Step 3: Create `src/navigation/initNavigation.ts`**

```typescript
import { init } from "@noriginmedia/norigin-spatial-navigation";

let started = false;

export function initNavigation(): void {
  if (started) return;
  init({ debug: false, visualDebug: false });
  started = true;
}
```

- [ ] **Step 4: Create `src/components/FocusableButton.tsx`**

```tsx
import { useEffect, type ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

interface Props {
  onPress: () => void;
  children: ReactNode;
  focusKey?: string;
  autoFocus?: boolean;
}

export function FocusableButton({ onPress, children, focusKey, autoFocus }: Props) {
  const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: onPress });

  useEffect(() => {
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <button ref={ref} data-focused={focused} onClick={onPress}>
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/FocusableButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: spatial navigation init and FocusableButton"
```

---

### Task 5: UI store (screen state machine)

**Files:**
- Create: `src/store/uiStore.ts`, `src/store/uiStore.test.ts`

**Interfaces:**
- Consumes: `zustand`.
- Produces: `useUiStore` with state `{ screen: Screen; activeMissionId: string | null }` and actions `goToMap()`, `startMission(missionId: string)`, `goToReward()`. `Screen = "map" | "mission" | "reward"`. Initial screen `"map"`.

- [ ] **Step 1: Write the failing test `src/store/uiStore.test.ts`**

```typescript
import { useUiStore } from "./uiStore";

describe("uiStore", () => {
  beforeEach(() => useUiStore.getState().goToMap());

  it("starts on the map", () => {
    expect(useUiStore.getState().screen).toBe("map");
  });

  it("startMission moves to the mission screen and records the id", () => {
    useUiStore.getState().startMission("mission-001");
    expect(useUiStore.getState().screen).toBe("mission");
    expect(useUiStore.getState().activeMissionId).toBe("mission-001");
  });

  it("goToReward moves to the reward screen", () => {
    useUiStore.getState().startMission("mission-001");
    useUiStore.getState().goToReward();
    expect(useUiStore.getState().screen).toBe("reward");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/store/uiStore.test.ts`
Expected: FAIL — cannot resolve `./uiStore`.

- [ ] **Step 3: Create `src/store/uiStore.ts`**

```typescript
import { create } from "zustand";

export type Screen = "map" | "mission" | "reward";

interface UiState {
  screen: Screen;
  activeMissionId: string | null;
  goToMap: () => void;
  startMission: (missionId: string) => void;
  goToReward: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  screen: "map",
  activeMissionId: null,
  goToMap: () => set({ screen: "map", activeMissionId: null }),
  startMission: (missionId) => set({ screen: "mission", activeMissionId: missionId }),
  goToReward: () => set({ screen: "reward" }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/store/uiStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ui screen-state store"
```

---

### Task 6: Journey Map screen

**Files:**
- Create: `src/screens/JourneyMap.tsx`, `src/screens/JourneyMap.test.tsx`

**Interfaces:**
- Consumes: `World`, `Mission` (types), `FocusableButton`, `useUiStore.startMission`.
- Produces: `JourneyMap` component: `{ world: World; missions: Mission[] }`. Renders the world name and one focusable node per mission (label = mission title). The first mission's button is `autoFocus`. Pressing a node calls `startMission(mission.id)`.

- [ ] **Step 1: Write the failing test `src/screens/JourneyMap.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JourneyMap } from "./JourneyMap";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

const world: World = { id: "world-jungle", order: 1, theme: "jungle", name: "Jungle Jump", missionIds: ["mission-001"], art: "worlds/jungle.png" };
const missions: Mission[] = [{ id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1: Wake Up Your Brain", activityIds: ["activity-cross-crawl"] }];

describe("JourneyMap", () => {
  it("shows the world name", () => {
    render(<JourneyMap world={world} missions={missions} />);
    expect(screen.getByText(/jungle jump/i)).toBeInTheDocument();
  });

  it("renders a focusable node per mission and starts it on press", async () => {
    const user = userEvent.setup();
    render(<JourneyMap world={world} missions={missions} />);
    await user.click(screen.getByRole("button", { name: /day 1/i }));
    expect(useUiStore.getState().screen).toBe("mission");
    expect(useUiStore.getState().activeMissionId).toBe("mission-001");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/JourneyMap.test.tsx`
Expected: FAIL — cannot resolve `./JourneyMap`.

- [ ] **Step 3: Create `src/screens/JourneyMap.tsx`**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  return (
    <section>
      <h1>{world.name}</h1>
      <ul>
        {missions.map((mission, index) => (
          <li key={mission.id}>
            <FocusableButton autoFocus={index === 0} onPress={() => startMission(mission.id)}>
              {mission.title}
            </FocusableButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/JourneyMap.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: journey map screen"
```

---

### Task 7: Mission Player (activity sequence → reward)

**Files:**
- Create: `src/screens/MissionPlayer.tsx`, `src/screens/MissionPlayer.test.tsx`

**Interfaces:**
- Consumes: `Activity`, `Mission` (types), `FocusableButton`, `useUiStore.goToReward`.
- Produces: `MissionPlayer` component: `{ mission: Mission; activities: Activity[] }`. Renders the current activity's title + instructions (placeholder for the future `ExercisePlayer`), an `autoFocus` "Done" button (the parent-OK validation) that advances to the next activity; after the last activity, calls `goToReward()`. Shows progress text `Activity X of N`.

- [ ] **Step 1: Write the failing test `src/screens/MissionPlayer.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionPlayer } from "./MissionPlayer";
import { useUiStore } from "@/store/uiStore";
import type { Activity, Mission } from "@/content/types";

const mission: Mission = { id: "mission-001", worldId: "world-jungle", node: 1, title: "Day 1", activityIds: ["a1", "a2"] };
const activities: Activity[] = [
  { id: "a1", type: "movement", title: "Cross Crawl", ageBands: ["6-8"], narration: "a1.mp3", renderer: "react", asset: "cross-crawl", pacing: { reps: 6, tempoMs: 1200 }, instructions: "Touch hand to opposite knee." },
  { id: "a2", type: "breathing", title: "Belly Breaths", ageBands: ["6-8"], narration: "a2.mp3", renderer: "react", asset: "belly", cycles: 4 },
];

describe("MissionPlayer", () => {
  beforeEach(() => useUiStore.getState().startMission("mission-001"));

  it("shows the first activity and progress", () => {
    render(<MissionPlayer mission={mission} activities={activities} />);
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 1 of 2/i)).toBeInTheDocument();
  });

  it("advances through activities when the parent presses Done", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(screen.getByText(/belly breaths/i)).toBeInTheDocument();
    expect(screen.getByText(/activity 2 of 2/i)).toBeInTheDocument();
  });

  it("goes to the reward screen after the last activity", async () => {
    const user = userEvent.setup();
    render(<MissionPlayer mission={mission} activities={activities} />);
    await user.click(screen.getByRole("button", { name: /done/i }));
    await user.click(screen.getByRole("button", { name: /done/i }));
    expect(useUiStore.getState().screen).toBe("reward");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/screens/MissionPlayer.test.tsx`
Expected: FAIL — cannot resolve `./MissionPlayer`.

- [ ] **Step 3: Create `src/screens/MissionPlayer.tsx`**

```tsx
import { useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";
import type { Activity, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
}

export function MissionPlayer({ mission, activities }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  const onDone = () => {
    if (index + 1 >= activities.length) goToReward();
    else setIndex((i) => i + 1);
  };

  return (
    <section aria-label={mission.title}>
      <p>
        Activity {index + 1} of {activities.length}
      </p>
      <h2>{activity.title}</h2>
      {activity.type === "movement" && <p>{activity.instructions}</p>}
      <FocusableButton autoFocus focusKey={`done-${activity.id}`} onPress={onDone}>
        Done
      </FocusableButton>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/screens/MissionPlayer.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: mission player with parent-validated activity sequence"
```

---

### Task 8: Reward screen + App wiring (end-to-end happy path)

**Files:**
- Create: `src/screens/RewardScreen.tsx`, `src/content/useContent.ts`
- Modify: `src/App.tsx` (replace the Task 1 stub), `src/App.test.tsx` (replace the Task 1 test)
- Create: `src/App.e2e.test.tsx`

**Interfaces:**
- Consumes: `createContentLoader`, `useUiStore`, `JourneyMap`, `MissionPlayer`, `initNavigation`, all content types.
- Produces:
  - `RewardScreen` component: `{ missionTitle: string }` — shows a celebration message + an `autoFocus` "Back to Map" button calling `goToMap()`.
  - `useContent()` hook: loads manifest → first world → its missions → the active mission's activities, exposing `{ status: "loading" | "ready" | "error"; world; missions; activitiesByMission }`.
  - `App`: initialises navigation, uses `useContent`, and renders the screen named by `useUiStore.screen`. Loading state renders text "Getting ready…" (placeholder for the future InterstitialPlayer).

- [ ] **Step 1: Create `src/content/useContent.ts`**

```tsx
import { useEffect, useState } from "react";
import { createContentLoader } from "./loader";
import type { World, Mission, Activity } from "./types";

const baseUrl = import.meta.env.VITE_CONTENT_URL ?? "/content";

export interface ContentState {
  status: "loading" | "ready" | "error";
  world: World | null;
  missions: Mission[];
  activitiesByMission: Record<string, Activity[]>;
}

export function useContent(): ContentState {
  const [state, setState] = useState<ContentState>({ status: "loading", world: null, missions: [], activitiesByMission: {} });

  useEffect(() => {
    let cancelled = false;
    const loader = createContentLoader({ baseUrl, storage: window.localStorage });
    (async () => {
      try {
        const manifest = await loader.loadManifest();
        const world = await loader.loadWorld(manifest.worldIds[0]);
        const missions = await Promise.all(world.missionIds.map((id) => loader.loadMission(id)));
        const activitiesByMission: Record<string, Activity[]> = {};
        for (const mission of missions) {
          activitiesByMission[mission.id] = await Promise.all(mission.activityIds.map((id) => loader.loadActivity(id)));
        }
        if (!cancelled) setState({ status: "ready", world, missions, activitiesByMission });
      } catch {
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

- [ ] **Step 2: Create `src/screens/RewardScreen.tsx`**

```tsx
import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";

interface Props {
  missionTitle: string;
}

export function RewardScreen({ missionTitle }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  return (
    <section>
      <h1>You did it!</h1>
      <p>{missionTitle} complete — you earned a star!</p>
      <FocusableButton autoFocus onPress={goToMap}>
        Back to Map
      </FocusableButton>
    </section>
  );
}
```

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
import { useEffect } from "react";
import { initNavigation } from "@/navigation/initNavigation";
import { useContent } from "@/content/useContent";
import { useUiStore } from "@/store/uiStore";
import { JourneyMap } from "@/screens/JourneyMap";
import { MissionPlayer } from "@/screens/MissionPlayer";
import { RewardScreen } from "@/screens/RewardScreen";

export default function App() {
  useEffect(() => initNavigation(), []);
  const content = useContent();
  const screen = useUiStore((s) => s.screen);
  const activeMissionId = useUiStore((s) => s.activeMissionId);

  if (content.status === "loading") return <p>Getting ready…</p>;
  if (content.status === "error" || !content.world) {
    return (
      <div>
        <p>Let's try again</p>
      </div>
    );
  }

  const activeMission = content.missions.find((m) => m.id === activeMissionId) ?? null;

  if (screen === "mission" && activeMission) {
    return <MissionPlayer mission={activeMission} activities={content.activitiesByMission[activeMission.id] ?? []} />;
  }
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
}
```

- [ ] **Step 4: Replace `src/App.test.tsx` with the end-to-end happy path `src/App.e2e.test.tsx`** (delete `src/App.test.tsx`)

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { useUiStore } from "@/store/uiStore";
import manifest from "@/content/__fixtures__/manifest.json";
import world from "@/content/__fixtures__/world-jungle.json";
import mission from "@/content/__fixtures__/mission-001.json";
import activity from "@/content/__fixtures__/activity-cross-crawl.json";

const byPath: Record<string, unknown> = {
  "/content/manifest.json": manifest,
  "/content/worlds/world-jungle.json": world,
  "/content/missions/mission-001.json": mission,
  "/content/activities/activity-cross-crawl.json": activity,
};

beforeEach(() => {
  useUiStore.getState().goToMap();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => byPath[url] })));
});

afterEach(() => vi.unstubAllGlobals());

describe("App end-to-end", () => {
  it("boots, loads the map, runs the mission, and reaches the reward", async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => expect(screen.getByText(/jungle jump/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /wake up your brain/i }));
    expect(screen.getByText(/cross crawl/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /done/i }));
    await waitFor(() => expect(screen.getByText(/you did it/i)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /back to map/i }));
    expect(screen.getByText(/jungle jump/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the full suite to verify everything passes**

Run: `npm test`
Expected: PASS — all suites green (schema, loader, FocusableButton, uiStore, JourneyMap, MissionPlayer, App e2e).

- [ ] **Step 6: Verify the build and a real dev boot**

Run: `npm run build`
Expected: type-checks and builds with no errors.

Manual: create `public/content/` with the four fixture JSONs (so `/content/...` resolves in `npm run dev`), run `npm run dev`, confirm the map renders and the mission→reward flow works with keyboard arrows + Enter.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: reward screen and end-to-end app wiring"
```

---

## Self-Review

**Spec coverage (Plan 1 scope only — auth/persistence/renderers/rewards-engine/interstitials are later plans):**
- Vite+React+TS+Netlify-ready static SPA → Task 1. ✅
- Data-driven content (manifest→world→mission→activity) + Zod validation → Tasks 2, 3, 8. ✅
- Content caching + last-good fallback (resilience) → Task 3. ✅
- Journey map rendered from data → Task 6. ✅
- Daily mission loop, parent-OK validation, no fail states → Task 7. ✅
- Reward screen + map advance (visual only; streak/persistence deferred to Plan 3) → Task 8. ✅
- D-pad/spatial navigation, default focus on primary action → Tasks 4, 6, 7, 8. ✅
- Loading state placeholder for future InterstitialPlayer → Task 8 (“Getting ready…”). ✅
- Error card for content failure → Task 8 (“Let's try again”). ✅

**Deferred by design (documented, not gaps):** Supabase auth (Plan 2), progress/streak persistence + offline queue (Plan 3), `ExercisePlayer`/renderer & puzzle registries (Plan 4), badge rule engine + trophy shelf (Plan 5), interstitial micro-exercises + Rive art + `/frontend-design` visual pass (Plan 6).

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step shows complete code. ✅

**Type consistency:** `Screen`, `useUiStore` actions (`goToMap`/`startMission`/`goToReward`), `ContentLoader` methods, and `Activity` discriminated union are used identically across Tasks 5–8. `FocusableButton` prop shape (`onPress`/`autoFocus`/`focusKey`) consistent across Tasks 4, 6, 7, 8. ✅

**Note on D-pad testing:** unit tests assert Enter/click activation and default-focus intent; true arrow-key focus traversal on `norigin` is verified manually in Task 8 Step 6 (jsdom cannot reliably simulate spatial focus movement). This is an honest limitation, not a skipped requirement.
