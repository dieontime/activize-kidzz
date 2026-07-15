import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("returns false for an empty or null-ish input", () => {
    expect(containsProfanity("")).toBe(false);
  });

  it("blocks an exact blocked word", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("blocks a blocked word inside a CamelCase compound", () => {
    expect(containsProfanity("SuperHellBoy")).toBe(true);
  });

  it("does not flag legitimate names that contain blocked substrings", () => {
    expect(containsProfanity("Cassidy")).toBe(false);
    expect(containsProfanity("grasshopper")).toBe(false);
    expect(containsProfanity("hello")).toBe(false);
    expect(containsProfanity("Michelle")).toBe(false);
  });
});
