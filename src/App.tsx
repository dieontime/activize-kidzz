import { useEffect } from "react";
import { initNavigation } from "@/navigation/initNavigation";
import { useContent } from "@/content/useContent";
import { useUiStore } from "@/store/uiStore";
import { JourneyMap } from "@/screens/JourneyMap";
import { MissionPlayer } from "@/screens/MissionPlayer";
import { RewardScreen } from "@/screens/RewardScreen";

export default function App() {
  useEffect(() => initNavigation(), []);
  const content = useContent();
  const screen = useUiStore((s) => s.screen);
  const activeMissionId = useUiStore((s) => s.activeMissionId);

  if (content.status === "loading") return <p>Getting ready…</p>;
  if (content.status === "error" || !content.world) {
    return (
      <div>
        <p>Let's try again</p>
      </div>
    );
  }

  const activeMission = content.missions.find((m) => m.id === activeMissionId) ?? null;

  if (screen === "mission" && activeMission) {
    return <MissionPlayer mission={activeMission} activities={content.activitiesByMission[activeMission.id] ?? []} />;
  }
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
}
