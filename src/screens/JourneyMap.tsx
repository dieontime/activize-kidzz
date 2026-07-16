import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-6">{world.name}</h1>
      <ul className="grid grid-cols-3 gap-4 list-none p-0 m-0">
        {missions.map((mission, index) => (
          <li key={mission.id}>
            <FocusableButton
              variant="card"
              className="w-full bg-storybook-mint text-storybook-mintText"
              autoFocus={index === 0}
              onPress={() => startMission(mission.id)}
            >
              {mission.title}
            </FocusableButton>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
