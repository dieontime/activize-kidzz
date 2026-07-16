import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

export function LoginScreen() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onPinDone = async (pin: PinIcon[]) => {
    try {
      await login(username, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Welcome back!</h1>
      <input
        className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
        placeholder="Your silly name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {username.length >= 3 && <EmojiPinKeypad onComplete={onPinDone} />}
      {error && <p className="text-lg text-red-700 mb-4">{error}</p>}
      <div className="flex gap-3 mt-4">
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setAuthScreen("signup")}>
          Make a new player
        </FocusableButton>
        <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => setAuthScreen("recovery")}>
          Forgot PIN?
        </FocusableButton>
      </div>
    </PageShell>
  );
}
