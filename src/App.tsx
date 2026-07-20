import { useEffect, type ReactNode } from "react";
import { initNavigation } from "@/navigation/initNavigation";
import { useContent } from "@/content/useContent";
import { useUiStore } from "@/store/uiStore";
import { useAuthStore } from "@/store/authStore";
import { useInterstitialStore } from "@/store/interstitialStore";
import { InterstitialPlayer } from "@/components/InterstitialPlayer";
import { JourneyMap } from "@/screens/JourneyMap";
import { MissionPlayer } from "@/screens/MissionPlayer";
import { RewardScreen } from "@/screens/RewardScreen";
import { TrophyShelf } from "@/screens/TrophyShelf";
import { ProfilePicker } from "@/screens/ProfilePicker";
import { LoginScreen } from "@/screens/LoginScreen";
import { SignupWizard } from "@/screens/SignupWizard";
import { RecoveryScreen } from "@/screens/RecoveryScreen";
import { FocusableButton } from "@/components/FocusableButton";

export default function App() {
  useEffect(() => initNavigation(), []);
  const authScreen = useAuthStore((s) => s.authScreen);

  let screen: ReactNode;
  if (authScreen === "profilePicker") screen = <ProfilePicker />;
  else if (authScreen === "login") screen = <LoginScreen />;
  else if (authScreen === "signup") screen = <SignupWizard />;
  else if (authScreen === "recovery") screen = <RecoveryScreen />;
  else screen = <MainApp />;

  return (
    <>
      <InterstitialPlayer />
      {screen}
    </>
  );
}

function MainApp() {
  const content = useContent();
  const screen = useUiStore((s) => s.screen);
  const activeMissionId = useUiStore((s) => s.activeMissionId);

  useEffect(() => {
    useInterstitialStore.getState().setPending(content.status === "loading");
  }, [content.status]);

  if (content.status === "loading") return null;
  if (content.status === "error" || !content.world) {
    return (
      <div>
        <p>Let's try again</p>
        <FocusableButton autoFocus onPress={content.retry}>
          Retry
        </FocusableButton>
      </div>
    );
  }

  const activeMission = content.missions.find((m) => m.id === activeMissionId) ?? null;

  if (screen === "mission" && activeMission) {
    return (
      <MissionPlayer
        mission={activeMission}
        activities={content.activitiesByMission[activeMission.id] ?? []}
        badges={content.badges}
        worldId={content.world.id}
        totalMissionsInWorld={content.world.missionIds.length}
      />
    );
  }
  if (screen === "reward") {
    return <RewardScreen missionTitle={activeMission?.title ?? "Today's mission"} badges={content.badges} />;
  }
  if (screen === "trophyShelf") {
    return <TrophyShelf badges={content.badges} />;
  }
  return <JourneyMap world={content.world} missions={content.missions} />;
}
