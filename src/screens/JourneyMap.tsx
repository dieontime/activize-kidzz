import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";
import type { World, Mission } from "@/content/types";

interface Props {
  world: World;
  missions: Mission[];
}

export function JourneyMap({ world, missions }: Props) {
  const startMission = useUiStore((s) => s.startMission);
  return (
    <section>
      <h1>{world.name}</h1>
      <ul>
        {missions.map((mission, index) => (
          <li key={mission.id}>
            <FocusableButton autoFocus={index === 0} onPress={() => startMission(mission.id)}>
              {mission.title}
            </FocusableButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
