import { describe, it, expect, vi, afterEach } from "vitest";
import { suggestUsernames } from "./usernameSuggestor";

describe("suggestUsernames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("never regenerates the exact original suffix even if the RNG tries to", () => {
    const spy = vi.spyOn(Math, "random");
    // Math.random() * 99 + 1 === 42  =>  Math.random() === 41/99
    const forcedValue = 41 / 99;
    // First call returns 41/99 (which would produce 42 and hit the guard),
    // then subsequent calls return distinct values to generate 3 different usernames
    spy
      .mockReturnValueOnce(forcedValue) // n=42, skipped by guard
      .mockReturnValueOnce(0.25) // n=25
      .mockReturnValueOnce(0.5) // n=50
      .mockReturnValueOnce(0.75); // n=75
    const suggestions = suggestUsernames("Otter42", 3);
    expect(suggestions).toHaveLength(3);
    for (const s of suggestions) {
      expect(s).not.toBe("Otter42");
    }
  });
});
