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
      <ul className="relative list-none p-0 m-0 mb-6 max-w-md before:content-[''] before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-1.5 before:-translate-x-1/2 before:bg-storybook-tan before:rounded-full">
        {missions.map((mission, index) => {
          const state = missionLockState(mission.node, progressNode, lastCompletedDate, today);
          const side = index % 2 === 0 ? "mr-auto" : "ml-auto";
          if (state === "locked") {
            return (
              <li key={mission.id} className={`relative z-10 w-2/3 mb-6 ${side}`}>
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
            <li key={mission.id} className={`relative z-10 w-2/3 mb-6 ${side}`}>
              <FocusableButton
                variant="card"
                className={`w-full bg-storybook-mint text-storybook-mintText ${state === "current" ? "storybook-pulse" : ""}`}
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
