import { useState } from "react";
import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";
import type { Activity, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
}

export function MissionPlayer({ mission, activities }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  const onDone = () => {
    if (index + 1 >= activities.length) goToReward();
    else setIndex((i) => i + 1);
  };

  return (
    <section aria-label={mission.title}>
      <p>
        Activity {index + 1} of {activities.length}
      </p>
      <h2>{activity.title}</h2>
      {activity.type === "movement" && <p>{activity.instructions}</p>}
      <FocusableButton autoFocus focusKey={`done-${activity.id}`} onPress={onDone}>
        Done
      </FocusableButton>
    </section>
  );
}
