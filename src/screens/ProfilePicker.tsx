import { useState } from "react";
import { EmojiPinKeypad, type PinIcon } from "@/components/EmojiPinKeypad";
import { avatarEmoji } from "@/components/AvatarPicker";
import { getKnownProfiles } from "@/lib/knownProfiles";
import { login } from "@/lib/auth";
import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useAuthStore } from "@/store/authStore";

export function ProfilePicker() {
  const completeAuthFlow = useAuthStore((s) => s.completeAuthFlow);
  const setAuthScreen = useAuthStore((s) => s.setAuthScreen);
  const [pickedUsername, setPickedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const profiles = getKnownProfiles();

  const onPinDone = async (pin: PinIcon[]) => {
    if (!pickedUsername) return;
    try {
      await login(pickedUsername, pin);
      completeAuthFlow();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  };

  if (pickedUsername) {
    return (
      <PageShell>
        <h1 className="text-3xl font-bold mb-6">Hi, {pickedUsername}!</h1>
        <EmojiPinKeypad onComplete={onPinDone} />
        {error && <p className="text-lg text-red-700 mt-4">{error}</p>}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Who's playing?</h1>
      <div role="group" aria-label="known profiles" className="grid grid-cols-4 gap-3 max-w-xs mb-6">
        {profiles.map((p, index) => (
          <FocusableButton
            key={p.profileId}
            variant="grid"
            className="bg-storybook-mint text-storybook-mintText"
            focusKey={`profile-${p.profileId}`}
            autoFocus={index === 0}
            onPress={() => setPickedUsername(p.username)}
          >
            {avatarEmoji(p.avatar)}
          </FocusableButton>
        ))}
      </div>
      <FocusableButton
        variant="pill"
        className="bg-storybook-peach text-storybook-peachText"
        autoFocus={profiles.length === 0}
        onPress={() => setAuthScreen("login")}
      >
        Use a different name
      </FocusableButton>
    </PageShell>
  );
}
