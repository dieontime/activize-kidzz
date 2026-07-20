import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

interface Props {
  missionTitle: string;
  badges: Badge[];
}

export function RewardScreen({ missionTitle, badges }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  const streakCount = useProgressStore((s) => s.streakCount);
  const newlyEarnedBadgeIds = useProgressStore((s) => s.newlyEarnedBadgeIds);
  const newlyEarnedBadges = badges.filter((b) => newlyEarnedBadgeIds.includes(b.id));

  return (
    <PageShell>
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-4">You did it!</h1>
        <p className="text-lg mb-4">{missionTitle} complete — you earned a star!</p>
        {streakCount >= 2 && (
          <p className="text-lg font-bold text-storybook-gold mb-4">{streakCount}-day streak!</p>
        )}
        {newlyEarnedBadges.map((badge) => (
          <p key={badge.id} className="text-lg font-bold text-storybook-gold mb-4">
            {badge.emoji} {badge.name}!
          </p>
        ))}
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
          Back to Map
        </FocusableButton>
      </section>
    </PageShell>
  );
}
