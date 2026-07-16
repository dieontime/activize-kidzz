import { useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";

export const PIN_ICONS = ["🐱", "🐶", "🐰", "🐼", "⚡", "🌈", "🌟", "🌙", "🍕", "🍔", "🍩", "🍎"] as const;
export type PinIcon = (typeof PIN_ICONS)[number];
export const PIN_LENGTH = 4;

interface Props {
  onComplete: (pin: PinIcon[]) => void;
}

export function EmojiPinKeypad({ onComplete }: Props) {
  const [entered, setEntered] = useState<PinIcon[]>([]);

  const tap = (icon: PinIcon) => {
    if (entered.length >= PIN_LENGTH) return;
    setEntered([...entered, icon]);
  };

  const clear = () => setEntered([]);
  const done = () => {
    if (entered.length === PIN_LENGTH) onComplete(entered);
  };

  return (
    <div>
      <div role="group" aria-label="pin icons" className="grid grid-cols-4 gap-3 max-w-xs mb-4">
        {PIN_ICONS.map((icon, index) => (
          <FocusableButton
            key={icon}
            variant="grid"
            className="bg-storybook-lavender text-storybook-lavenderText"
            focusKey={`pin-icon-${icon}`}
            autoFocus={index === 0}
            onPress={() => tap(icon)}
          >
            {icon}
          </FocusableButton>
        ))}
      </div>
      <div aria-label="entered pin" className="flex gap-3 mb-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`w-4 h-4 rounded-full ${i < entered.length ? "bg-storybook-gold" : "bg-storybook-tan"}`}
          />
        ))}
      </div>
      <div className="flex gap-3">
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={clear}>
          Clear
        </FocusableButton>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={done}>
          Done
        </FocusableButton>
      </div>
    </div>
  );
}
