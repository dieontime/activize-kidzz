import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
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
    <div>
      <h1>Welcome back!</h1>
      <input
        placeholder="Your silly name"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {username.length >= 3 && <EmojiPinKeypad onComplete={onPinDone} />}
      {error && <p>{error}</p>}
      <div>
        <FocusableButton autoFocus onPress={() => setAuthScreen("signup")}>Make a new player</FocusableButton>
        <FocusableButton onPress={() => setAuthScreen("recovery")}>Forgot PIN?</FocusableButton>
      </div>
    </div>
  );
}
