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
