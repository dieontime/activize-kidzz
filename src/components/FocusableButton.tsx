import { useEffect, type ReactNode } from "react";
import { useFocusable } from "@noriginmedia/norigin-spatial-navigation";

interface Props {
  onPress: () => void;
  children: ReactNode;
  focusKey?: string;
  autoFocus?: boolean;
}

export function FocusableButton({ onPress, children, focusKey, autoFocus }: Props) {
  const { ref, focused, focusSelf } = useFocusable({ focusKey, onEnterPress: onPress });

  useEffect(() => {
    if (autoFocus) focusSelf();
  }, [autoFocus, focusSelf]);

  return (
    <button ref={ref} data-focused={focused} onClick={onPress}>
      {children}
    </button>
  );
}
