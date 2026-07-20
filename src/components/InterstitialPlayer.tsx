import { useInterstitial } from "@/lib/useInterstitial";
import { useInterstitialStore } from "@/store/interstitialStore";
import { rendererRegistry } from "@/content/rendererRegistry";

export function InterstitialPlayer() {
  const pending = useInterstitialStore((s) => s.pending);
  const result = useInterstitial(pending);

  if (result.state === "hidden") return null;

  if (result.state === "ready") {
    return (
      <div role="status" aria-label="Ready" className="fixed inset-0 z-50 flex items-center justify-center bg-storybook-cream">
        <p className="text-2xl font-bold">Ready!</p>
      </div>
    );
  }

  const Renderer = rendererRegistry[result.activity.renderer];

  return (
    <div role="status" aria-label="Loading" className="fixed inset-0 z-50 flex items-center justify-center bg-storybook-cream">
      <Renderer activity={result.activity} />
    </div>
  );
}
