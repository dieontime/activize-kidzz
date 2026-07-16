import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { AvatarPicker, type AvatarId } from "@/components/AvatarPicker";
import { containsProfanity } from "@/lib/profanity";
import { suggestUsernames } from "@/lib/usernameSuggestor";
import { signup, checkUsernameAvailable } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { useAuthStore } from "@/store/authStore";

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
    const ok = await checkUsernameAvailable(username);
    if (!ok) {
      setUsernameError("That name is already taken");
      setSuggestions(suggestUsernames(username, 3));
      return;
    }
    setUsernameError(null);
    setSuggestions([]);
    setStep("pin");
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
    const result = await signup({ username, pin, avatar, age_band: band });
    setRecoveryCode(result.recoveryCode);
    setStep("recovery");
  };

  if (step === "recovery" && recoveryCode) {
    return (
      <div>
        <h2>Save this code!</h2>
        <p>Show it to a parent. If you forget your PIN, this gets you back in.</p>
        <div>{recoveryCode}</div>
        <FocusableButton autoFocus onPress={completeAuthFlow}>OK, got it</FocusableButton>
      </div>
    );
  }

  return (
    <div>
      {step === "username" && (
        <>
          <h2>Pick a silly name!</h2>
          <input
            placeholder="Your silly name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {usernameError && <p>{usernameError}</p>}
          {suggestions.length > 0 && (
            <div>
              {suggestions.map((s) => (
                <FocusableButton key={s} onPress={() => { setUsername(s); setSuggestions([]); setUsernameError(null); }}>
                  {s}
                </FocusableButton>
              ))}
            </div>
          )}
          <FocusableButton autoFocus onPress={goUsername}>Next</FocusableButton>
        </>
      )}
      {step === "pin" && (
        <>
          <h2>Pick 4 icons for your PIN</h2>
          <EmojiPinKeypad onComplete={goPinDone} />
        </>
      )}
      {step === "avatar" && (
        <>
          <h2>Pick your face!</h2>
          <AvatarPicker onPick={setAvatar} selected={avatar ?? undefined} />
          <FocusableButton focusKey="avatar-next" onPress={goAvatar}>Next</FocusableButton>
        </>
      )}
      {step === "band" && (
        <>
          <h2>How old are you?</h2>
          <div>
            <FocusableButton autoFocus onPress={() => goBand("3-5")}>3-5</FocusableButton>
            <FocusableButton onPress={() => goBand("6-8")}>6-8</FocusableButton>
          </div>
        </>
      )}
    </div>
  );
}
