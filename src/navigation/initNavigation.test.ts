import { init } from "@noriginmedia/norigin-spatial-navigation";
import { initNavigation } from "./initNavigation";

vi.mock("@noriginmedia/norigin-spatial-navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@noriginmedia/norigin-spatial-navigation")>();
  return { ...actual, init: vi.fn() };
});

describe("initNavigation", () => {
  it("only calls the underlying init once even when invoked twice", () => {
    initNavigation();
    initNavigation();
    expect(vi.mocked(init)).toHaveBeenCalledTimes(1);
  });
});
