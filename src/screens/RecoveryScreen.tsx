import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { recoverPin } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

type Stage = "creds" | "newpin" | "done";

export function RecoveryScreen() {
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [stage, setStage] = useState<Stage>("creds");
  const [username, setUsername] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [newRecovery, setNewRecovery] = useState<string | null>(null);

  const submitNewPin = async (pin: PinIcon[]) => {
    try {
      const result = await recoverPin(username, code, pin);
      setNewRecovery(result.recoveryCode);
      setStage("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recovery failed");
      setStage("creds");
    }
  };

  if (stage === "creds") {
    return (
      <div>
        <h1>Forgot your PIN?</h1>
        <input
          placeholder="Your silly name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Recovery code (PURPLE-FROG-1234)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p>{error}</p>}
        <FocusableButton autoFocus onPress={() => setStage("newpin")}>Next</FocusableButton>
        <FocusableButton onPress={() => setAuthScreen("login")}>Back to login</FocusableButton>
      </div>
    );
  }
  if (stage === "newpin") {
    return (
      <div>
        <h2>Pick a new PIN</h2>
        <EmojiPinKeypad onComplete={submitNewPin} />
        <FocusableButton onPress={() => setStage("creds")}>Back</FocusableButton>
      </div>
    );
  }
  return (
    <div>
      <h2>All set!</h2>
      <p>Your new recovery code:</p>
      <div>{newRecovery}</div>
      <p>Show this to a parent. The old code no longer works.</p>
      <FocusableButton autoFocus onPress={() => setAuthScreen("login")}>OK, log in</FocusableButton>
    </div>
  );
}
