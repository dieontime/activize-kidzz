import { suggestUsernames } from "./usernameSuggestor";

describe("suggestUsernames", () => {
  it("returns the requested count of suggestions", () => {
    expect(suggestUsernames("Otter", 3)).toHaveLength(3);
  });

  it("returns unique suggestions", () => {
    const suggestions = suggestUsernames("Otter", 5);
    expect(new Set(suggestions).size).toBe(5);
  });

  it("strips a trailing number from the base before suggesting", () => {
    const suggestions = suggestUsernames("Otter42", 3);
    for (const s of suggestions) {
      expect(s.startsWith("Otter")).toBe(true);
      expect(s).not.toMatch(/^Otter42/);
    }
  });
});
