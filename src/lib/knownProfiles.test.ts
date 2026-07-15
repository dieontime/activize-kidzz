import { getKnownProfiles, addKnownProfile } from "./knownProfiles";

describe("knownProfiles", () => {
  beforeEach(() => window.localStorage.clear());

  it("returns an empty list when nothing is cached", () => {
    expect(getKnownProfiles()).toEqual([]);
  });

  it("returns [] when the cached value is corrupted JSON", () => {
    window.localStorage.setItem("activize:knownProfiles", "not-json{");
    expect(getKnownProfiles()).toEqual([]);
  });

  it("adds a profile and reflects it in getKnownProfiles", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    expect(getKnownProfiles()).toEqual([{ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" }]);
  });

  it("upserts by profileId instead of duplicating", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_dog" });
    expect(getKnownProfiles()).toEqual([{ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_dog" }]);
  });

  it("keeps multiple distinct profiles", () => {
    addKnownProfile({ profileId: "p1", username: "SpeedyOtter", avatar: "avatar_cat" });
    addKnownProfile({ profileId: "p2", username: "BraveComet", avatar: "avatar_dog" });
    expect(getKnownProfiles()).toHaveLength(2);
  });
});
