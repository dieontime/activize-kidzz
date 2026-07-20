import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import { useProgressStore } from "@/store/progressStore";
import { missionLockState } from "@/lib/missionLockState";
import { todayDateString } from "@/lib/date";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  const goToTrophyShelf = useUiStore((s) => s.goToTrophyShelf);
  const progressNode = useProgressStore((s) => s.node);
  const lastCompletedDate = useProgressStore((s) => s.lastCompletedDate);
  const today = todayDateString();

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0 mb-6">
        {missions.map((mission) => {
          const state = missionLockState(mission.node, progressNode, lastCompletedDate, today);
          if (state === "locked") {
            return (
              <li key={mission.id}>
                <div
                  aria-label={`${mission.title}, locked`}
                  className="w-full rounded-2xl p-4 text-center font-bold bg-storybook-tan text-storybook-ink opacity-60"
                >
                  {mission.title}
                </div>
              </li>
            );
          }
          return (
            <li key={mission.id}>
              <FocusableButton
                variant="card"
                className="w-full bg-storybook-mint text-storybook-mintText"
                autoFocus={state === "current"}
                onPress={() => startMission(mission.id)}
              >
                {mission.title}
              </FocusableButton>
            </li>
          );
        })}
      </ul>
      <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" onPress={goToTrophyShelf}>
        Trophy Shelf
      </FocusableButton>
    </PageShell>
  );
}
