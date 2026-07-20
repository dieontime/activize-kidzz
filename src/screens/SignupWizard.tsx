import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { AvatarPicker, type AvatarId } from "@/components/AvatarPicker";
import { containsProfanity } from "@/lib/profanity";
import { suggestUsernames } from "@/lib/usernameSuggestor";
import { signup, checkUsernameAvailable } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";
import { useInterstitialStore } from "@/store/interstitialStore";

type Step = "username" | "pin" | "avatar" | "band" | "recovery";

export function SignupWizard() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pin, setPin] = useState<PinIcon[]>([]);
  const [avatar, setAvatar] = useState<AvatarId | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  const goUsername = async () => {
    if (username.length < 3) {
      setUsernameError("Pick at least 3 letters");
      return;
    }
    if (containsProfanity(username)) {
      setUsernameError("Try another name");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    useInterstitialStore.getState().setPending(true);
    try {
      const ok = await checkUsernameAvailable(username);
      if (!ok) {
        setUsernameError("That name is already taken");
        setSuggestions(suggestUsernames(username, 3));
        return;
      }
      setUsernameError(null);
      setSuggestions([]);
      setStep("pin");
    } finally {
      useInterstitialStore.getState().setPending(false);
    }
  };

  const goPinDone = (icons: PinIcon[]) => {
    setPin(icons);
    setStep("avatar");
  };

  const goAvatar = () => {
    if (avatar) setStep("band");
  };

  const goBand = async (band: "3-5" | "6-8") => {
    if (!avatar) return;
    useInterstitialStore.getState().setPending(true);
    try {
      const result = await signup({ username, pin, avatar, age_band: band });
      setRecoveryCode(result.recoveryCode);
      setStep("recovery");
    } finally {
      useInterstitialStore.getState().setPending(false);
    }
  };

  if (step === "recovery" && recoveryCode) {
    return (
      <PageShell>
        <h2 className="text-2xl font-bold mb-2">Save this code!</h2>
        <p className="text-lg mb-4">Show it to a parent. If you forget your PIN, this gets you back in.</p>
        <div className="text-2xl font-bold bg-storybook-lavender text-storybook-lavenderText rounded-2xl p-4 mb-6 inline-block">
          {recoveryCode}
        </div>
        <div>
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={completeAuthFlow}>
            OK, got it
          </FocusableButton>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {step === "username" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick a silly name!</h2>
          <input
            className="rounded-full px-5 py-3 mb-4 border-2 border-storybook-lavender bg-white text-storybook-ink"
            placeholder="Your silly name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameError && <p className="text-lg text-red-700 mb-4">{usernameError}</p>}
          {suggestions.length > 0 && (
            <div className="flex gap-3 mb-4">
              {suggestions.map((s) => (
                <FocusableButton
                  key={s}
                  variant="pill"
                  className="bg-storybook-mint text-storybook-mintText"
                  onPress={() => { setUsername(s); setSuggestions([]); setUsernameError(null); }}
                >
                  {s}
                </FocusableButton>
              ))}
            </div>
          )}
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goUsername}>
            Next
          </FocusableButton>
        </>
      )}
      {step === "pin" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick 4 icons for your PIN</h2>
          <EmojiPinKeypad onComplete={goPinDone} />
        </>
      )}
      {step === "avatar" && (
        <>
          <h2 className="text-2xl font-bold mb-4">Pick your face!</h2>
          <AvatarPicker onPick={setAvatar} selected={avatar ?? undefined} />
          <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText mt-4" focusKey="avatar-next" onPress={goAvatar}>
            Next
          </FocusableButton>
        </>
      )}
      {step === "band" && (
        <>
          <h2 className="text-2xl font-bold mb-4">How old are you?</h2>
          <div className="flex gap-3">
            <FocusableButton variant="pill" className="bg-storybook-mint text-storybook-mintText" autoFocus onPress={() => goBand("3-5")}>
              3-5
            </FocusableButton>
            <FocusableButton variant="pill" className="bg-storybook-lavender text-storybook-lavenderText" onPress={() => goBand("6-8")}>
              6-8
            </FocusableButton>
          </div>
        </>
      )}
    </PageShell>
  );
}
