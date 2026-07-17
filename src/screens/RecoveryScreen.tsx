import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { recoverPin } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
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
      <PageShell>
        <h1 className="text-3xl font-bold mb-6">Forgot your PIN?</h1>
        <input
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink block"
          placeholder="Your silly name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink block"
          placeholder="Recovery code (PURPLE-FROG-1234)"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        {error && <p className="text-lg text-red-700 mb-4">{error}</p>}
        <div className="flex gap-3">
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setStage("newpin")}>
            Next
          </FocusableButton>
          <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => setAuthScreen("login")}>
            Back to login
          </FocusableButton>
        </div>
      </PageShell>
    );
  }
  if (stage === "newpin") {
    return (
      <PageShell>
        <h2 className="text-2xl font-bold mb-4">Pick a new PIN</h2>
        <EmojiPinKeypad onComplete={submitNewPin} />
        <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText mt-4" onPress={() => setStage("creds")}>
          Back
        </FocusableButton>
      </PageShell>
    );
  }
  return (
    <PageShell>
      <h2 className="text-2xl font-bold mb-4">All set!</h2>
      <p className="text-lg mb-2">Your new recovery code:</p>
      <div className="text-2xl font-bold bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-4 mb-4 inline-block">
        {newRecovery}
      </div>
      <p className="text-lg mb-6">Show this to a parent. The old code no longer works.</p>
      <div>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={() => setAuthScreen("login")}>
          OK, log in
        </FocusableButton>
      </div>
    </PageShell>
  );
}
