import { useSequenceMemory } from "@/lib/useSequenceMemory";
import { FocusableButton } from "@/components/FocusableButton";
import type { PuzzleActivity } from "@/content/types";

interface Props {
  activity: PuzzleActivity;
  onValidated: () => void;
}

export function SequenceMemoryPuzzle({ activity, onValidated }: Props) {
  const { icons, sequence } = activity.puzzle;
  const { phase, watchIndex, submit } = useSequenceMemory(sequence, onValidated);

  if (phase === "success") {
    return (
      <div role="status" aria-label="Solved">
        <p className="text-2xl font-bold">🎉 Got it!</p>
      </div>
    );
  }

  const watching = phase === "watching";
  const highlightedIcon = watching ? sequence[watchIndex] : null;

  return (
    <div role="group" aria-label="sequence memory puzzle" className="grid grid-cols-4 gap-3 max-w-xs mb-4">
      {icons.map((icon, index) => (
        <FocusableButton
          key={icon}
          variant="grid"
          className={icon === highlightedIcon ? "bg-storybook-gold" : "bg-storybook-lavender text-storybook-lavenderText"}
          focusKey={`seq-icon-${icon}`}
          autoFocus={index === 0}
          disabled={watching}
          onPress={() => submit(icon)}
        >
          {icon}
        </FocusableButton>
      ))}
    </div>
  );
}
