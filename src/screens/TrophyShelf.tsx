import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import type { Badge } from "@/content/types";

interface Props {
  badges: Badge[];
}

export function TrophyShelf({ badges }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  const earnedBadgeIds = useProgressStore((s) => s.earnedBadgeIds);

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">Trophy Shelf</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0 mb-6">
        {badges.map((badge) => {
          const earned = earnedBadgeIds.includes(badge.id);
          return (
            <li key={badge.id}>
              <div
                aria-label={earned ? badge.name : `${badge.name}, locked`}
                className={`w-full rounded-2xl p-4 text-center font-bold ${
                  earned ? "bg-storybook-mint text-storybook-mintText" : "bg-storybook-tan text-storybook-ink opacity-60"
                }`}
              >
                <div className="text-4xl mb-2">{earned ? badge.emoji : "🔒"}</div>
                {earned ? badge.name : "Locked"}
              </div>
            </li>
          );
        })}
      </ul>
      <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
        Back to Map
      </FocusableButton>
    </PageShell>
  );
}
