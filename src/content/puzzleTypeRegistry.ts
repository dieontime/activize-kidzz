import type { ComponentType } from "react";
import { SequenceMemoryPuzzle } from "@/components/puzzles/SequenceMemoryPuzzle";
import type { PuzzleActivity, PuzzleData } from "./types";

interface PuzzleComponentProps {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export const puzzleTypeRegistry: Record<PuzzleData["puzzleType"], ComponentType<PuzzleComponentProps>> = {
  sequence_memory: SequenceMemoryPuzzle,
};
