import { puzzleTypeRegistry } from "./puzzleTypeRegistry";
import { SequenceMemoryPuzzle } from "@/components/puzzles/SequenceMemoryPuzzle";

describe("puzzleTypeRegistry", () => {
  it("maps sequence_memory to SequenceMemoryPuzzle", () => {
    expect(puzzleTypeRegistry.sequence_memory).toBe(SequenceMemoryPuzzle);
  });
});
