import { FocusableButton } from "@/components/FocusableButton";

interface Props {
  text: string;
}

export function NarrationButton({ text }: Props) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const speak = () => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  return (
    <FocusableButton onPress={speak} variant="pill" className="bg-storybook-mint text-storybook-mintText">
      🔊 Read it
    </FocusableButton>
  );
}
