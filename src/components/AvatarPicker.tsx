import { FocusableButton } from "@/components/FocusableButton";

export const AVATARS = [
  "avatar_cat", "avatar_dog", "avatar_fox", "avatar_owl",
  "avatar_robot", "avatar_unicorn", "avatar_dragon", "avatar_dino",
  "avatar_panda", "avatar_lion", "avatar_bear", "avatar_frog",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export const AVATAR_EMOJI: Record<AvatarId, string> = {
  avatar_cat: "🐱", avatar_dog: "🐶", avatar_fox: "🦊", avatar_owl: "🦉",
  avatar_robot: "🤖", avatar_unicorn: "🦄", avatar_dragon: "🐲", avatar_dino: "🦖",
  avatar_panda: "🐼", avatar_lion: "🦁", avatar_bear: "🐻", avatar_frog: "🐸",
};

export function avatarEmoji(id: string | null | undefined): string {
  if (!id) return "👤";
  return (AVATAR_EMOJI as Record<string, string>)[id] ?? "👤";
}

interface Props {
  onPick: (a: AvatarId) => void;
  selected?: AvatarId;
}

export function AvatarPicker({ onPick }: Props) {
  return (
    <div role="group" aria-label="avatars" className="grid grid-cols-4 gap-3 max-w-xs">
      {AVATARS.map((a, index) => (
        <FocusableButton
          key={a}
          variant="grid"
          className="bg-storybook-mint text-storybook-mintText"
          focusKey={`avatar-${a}`}
          autoFocus={index === 0}
          onPress={() => onPick(a)}
        >
          {AVATAR_EMOJI[a]}
        </FocusableButton>
      ))}
    </div>
  );
}
