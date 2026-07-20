import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { FocusableButton } from "@/components/FocusableButton";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { useUiStore } from "@/store/uiStore";
import { recordMissionCompletion } from "@/lib/progress";
import type { Activity, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
}

export function MissionPlayer({ mission, activities }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  useEffect(() => {
    if (activities.length === 0) {
      void recordMissionCompletion(mission.id, mission.node, 0);
      goToReward();
    }
  }, [activities, goToReward, mission.id, mission.node]);

  const onDone = () => {
    if (index + 1 >= activities.length) {
      void recordMissionCompletion(mission.id, mission.node, activities.length);
      goToReward();
    } else {
      setIndex((i) => i + 1);
    }
  };

  if (!activity) return null;

  return (
    <PageShell>
      <section aria-label={mission.title}>
        <p className="text-lg opacity-80 mb-4">
          Activity {index + 1} of {activities.length}
        </p>
        <h2 className="text-2xl font-bold mb-2">{activity.title}</h2>
        {activity.type === "movement" || activity.type === "breathing" ? (
          <ExercisePlayer key={activity.id} activity={activity} onValidated={onDone} />
        ) : (
          <FocusableButton
            key={activity.id}
            variant="pill"
            className="bg-storybook-peach text-storybook-peachText"
            autoFocus
            focusKey={`done-${activity.id}`}
            onPress={onDone}
          >
            Done
          </FocusableButton>
        )}
      </section>
    </PageShell>
  );
}
