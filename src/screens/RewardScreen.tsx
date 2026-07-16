import { FocusableButton } from "@/components/FocusableButton";
import { PageShell } from "@/components/PageShell";
import { useUiStore } from "@/store/uiStore";

interface Props {
  missionTitle: string;
}

export function RewardScreen({ missionTitle }: Props) {
  const goToMap = useUiStore((s) => s.goToMap);
  return (
    <PageShell>
      <section className="text-center">
        <h1 className="text-3xl font-bold mb-4">You did it!</h1>
        <p className="text-lg mb-8">{missionTitle} complete — you earned a star!</p>
        <FocusableButton variant="pill" className="bg-storybook-peach text-storybook-peachText" autoFocus onPress={goToMap}>
          Back to Map
        </FocusableButton>
      </section>
    </PageShell>
  );
}
