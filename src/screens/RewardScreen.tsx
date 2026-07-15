import { FocusableButton } from "@/components/FocusableButton";
import { useUiStore } from "@/store/uiStore";

interface Props {
  missionTitle: string;
}

export function RewardScreen({ missionTitle }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  return (
    <section>
      <h1>You did it!</h1>
      <p>{missionTitle} complete — you earned a star!</p>
      <FocusableButton autoFocus onPress={goToMap}>
        Back to Map
      </FocusableButton>
    </section>
  );
}
