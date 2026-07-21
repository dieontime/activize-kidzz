import { puzzleTypeRegistry } from "@/content/puzzleTypeRegistry";
import type { PuzzleActivity } from "@/content/types";

interface Props {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export function PuzzlePlayer({ activity, onValidated }: Props) {
  const PuzzleComponent = puzzleTypeRegistry[activity.puzzle.puzzleType];
  return <PuzzleComponent activity={activity} onValidated={onValidated} />;
}
