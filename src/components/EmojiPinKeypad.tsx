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
      <div role="group" aria-label="pin icons">
        {PIN_ICONS.map((icon, index) => (
          <FocusableButton key={icon} focusKey={`pin-icon-${icon}`} autoFocus={index === 0} onPress={() => tap(icon)}>
            {icon}
          </FocusableButton>
        ))}
      </div>
      <div aria-label="entered pin">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span key={i}>{entered[i] ?? ""}</span>
        ))}
      </div>
      <div>
        <FocusableButton onPress={clear}>Clear</FocusableButton>
        <FocusableButton onPress={done}>Done</FocusableButton>
      </div>
    </div>
  );
}
