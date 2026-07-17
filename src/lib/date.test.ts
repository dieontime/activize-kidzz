import { describe, it, expect, afterEach, vi } from "vitest";
import { todayDateString, yesterdayDateString } from "./date";

describe("date utilities", () => {
  afterEach(() => vi.useRealTimers());

  it("todayDateString returns the current UTC date as YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T15:30:00.000Z"));
    expect(todayDateString()).toBe("2026-07-17");
  });

  it("yesterdayDateString returns the day before today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T15:30:00.000Z"));
    expect(yesterdayDateString()).toBe("2026-07-16");
  });

  it("yesterdayDateString correctly crosses a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T02:00:00.000Z"));
    expect(yesterdayDateString()).toBe("2026-07-31");
  });
});
