import manifestJson from "./__fixtures__/manifest.json";
import worldJson from "./__fixtures__/world-jungle.json";
import missionJson from "./__fixtures__/mission-001.json";
import activityJson from "./__fixtures__/activity-cross-crawl.json";
import badgeStreak3Json from "./__fixtures__/badge-streak-3.json";
import badgeWorldCompleteJson from "./__fixtures__/badge-world-complete-jungle.json";
import badgeMissionsTotalJson from "./__fixtures__/badge-missions-total.json";
import { parseManifest, parseWorld, parseMission, parseActivity, parseBadge } from "./schema";

const puzzleActivityJson = {
  id: "activity-sequence-1", type: "puzzle", title: "Remember the Order",
  ageBands: ["6-8"], narration: "sequence-1.mp3",
  puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶", "🐰"], sequence: ["🐱", "🐶"] },
};

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

  it("parses a puzzle activity with a sequence_memory puzzle", () => {
    const a = parseActivity(puzzleActivityJson);
    expect(a.type).toBe("puzzle");
    if (a.type === "puzzle") {
      expect(a.puzzle).toEqual({ puzzleType: "sequence_memory", icons: ["🐱", "🐶", "🐰"], sequence: ["🐱", "🐶"] });
    }
  });

  it("rejects a sequence_memory puzzle whose sequence references an icon not in icons", () => {
    expect(() =>
      parseActivity({
        ...puzzleActivityJson,
        puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐶"], sequence: ["🐱", "🦊"] },
      }),
    ).toThrow();
  });

  it("rejects a sequence_memory puzzle with duplicate icons", () => {
    expect(() =>
      parseActivity({
        ...puzzleActivityJson,
        puzzle: { puzzleType: "sequence_memory", icons: ["🐱", "🐱", "🐶"], sequence: ["🐱"] },
      }),
    ).toThrow();
  });

  it("rejects a manifest missing worldIds", () => {
    expect(() => parseManifest({ version: 1 })).toThrow();
  });

  it("parses a streak badge", () => {
    const b = parseBadge(badgeStreak3Json);
    expect(b.rule).toEqual({ kind: "streak", value: 3 });
  });

  it("parses a world_complete badge", () => {
    const b = parseBadge(badgeWorldCompleteJson);
    expect(b.rule).toEqual({ kind: "world_complete", worldId: "world-jungle" });
  });

  it("parses a missions_total badge", () => {
    const b = parseBadge(badgeMissionsTotalJson);
    expect(b.rule).toEqual({ kind: "missions_total", value: 10 });
  });

  it("rejects a badge with an unknown rule kind", () => {
    expect(() => parseBadge({ ...badgeStreak3Json, rule: { kind: "mystery", value: 1 } })).toThrow();
  });
});
