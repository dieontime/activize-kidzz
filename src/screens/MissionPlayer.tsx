import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { FocusableButton } from "@/components/FocusableButton";
import { ExercisePlayer } from "@/components/ExercisePlayer";
import { useUiStore } from "@/store/uiStore";
import { recordMissionCompletion } from "@/lib/progress";
import { evaluateAndAwardBadges } from "@/lib/badges";
import type { Activity, Badge, Mission } from "@/content/types";

interface Props {
  mission: Mission;
  activities: Activity[];
  badges: Badge[];
  worldId: string;
  totalMissionsInWorld: number;
}

export function MissionPlayer({ mission, activities, badges, worldId, totalMissionsInWorld }: Props) {
  const goToReward = useUiStore((s) => s.goToReward);
  const [index, setIndex] = useState(0);
  const activity = activities[index];

  async function completeMission(activitiesDone: number): Promise<void> {
    await recordMissionCompletion(mission.id, mission.node, activitiesDone);
    await evaluateAndAwardBadges(badges, { worldId, totalMissionsInWorld });
  }

  useEffect(() => {
    if (activities.length === 0) {
      void completeMission(0);
      goToReward();
    }
    // completeMission closes over mission/badges/worldId/totalMissionsInWorld,
    // all listed below -- it is intentionally recreated each render, not memoized.
  }, [activities, goToReward, mission.id, mission.node, badges, worldId, totalMissionsInWorld]);

  const onDone = () => {
    if (index + 1 >= activities.length) {
      void completeMission(activities.length);
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
