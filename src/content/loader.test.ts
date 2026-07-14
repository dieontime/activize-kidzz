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

function flakyFetch(body: unknown): typeof fetch {
  let calls = 0;
  return (async () => {
    calls += 1;
    if (calls > 1) throw new Error("network down");
    return { ok: true, json: async () => body };
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

  it("serves last-good from in-memory cache when the network fails and there is no storage", async () => {
    const loader = createContentLoader({ baseUrl: "/content", fetchFn: flakyFetch(manifestJson) });
    expect((await loader.loadManifest()).worldIds).toEqual(["world-jungle"]); // primes memory cache
    expect((await loader.loadManifest()).worldIds).toEqual(["world-jungle"]); // served from memory
  });

  it("rejects when the network fails and the stored cache entry is corrupted", async () => {
    const storage = fakeStorage();
    storage.setItem("activize:content:manifest.json", "not-json{");

    const offline = createContentLoader({ baseUrl: "/content", fetchFn: failFetch(), storage });
    await expect(offline.loadManifest()).rejects.toThrow("network down");
  });
});
