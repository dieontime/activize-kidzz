import { useEffect, type ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

type Variant = "pill" | "card" | "grid";

interface Props {
  onPress: () => void;
  children: ReactNode;
  focusKey?: string;
  autoFocus?: boolean;
  variant?: Variant;
  className?: string;
  disabled?: boolean;
}

const FOCUS_RING =
  "data-[focused=true]:outline data-[focused=true]:outline-4 data-[focused=true]:outline-dashed data-[focused=true]:outline-storybook-gold data-[focused=true]:outline-offset-2 data-[focused=true]:shadow-[0_0_16px_2px_rgba(224,164,88,0.5)]";

const VARIANT_CLASSES: Record<Variant, string> = {
  pill: `rounded-full px-6 py-3 font-bold data-[focused=true]:scale-110 ${FOCUS_RING}`,
  card: `rounded-2xl p-4 text-center font-bold data-[focused=true]:scale-[1.08] ${FOCUS_RING}`,
  grid: `rounded-xl p-2 text-2xl data-[focused=true]:scale-[1.12] ${FOCUS_RING}`,
};

export function FocusableButton({
  onPress,
  children,
  focusKey,
  autoFocus,
  variant = "pill",
  className,
  disabled = false,
}: Props) {
  const handlePress = () => {
    if (!disabled) onPress();
  };
  const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: handlePress });

  useEffect(() => {
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <button
      ref={ref}
      data-focused={focused}
      disabled={disabled}
      onClick={handlePress}
      className={`border-none cursor-pointer transition-transform duration-150 ${VARIANT_CLASSES[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
