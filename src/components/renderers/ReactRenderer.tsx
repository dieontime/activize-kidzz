import type { RendererProps } from "@/content/types";

export function ReactRenderer({ activity }: RendererProps) {
  if (activity.type === "movement") {
    return (
      <div className="text-center">
        <div className="text-6xl mb-4 animate-bounce">🏃</div>
        <p className="text-lg">{activity.instructions}</p>
      </div>
    );
  }
  return (
    <div className="text-center">
      <div className="text-6xl mb-4 animate-pulse">🫁</div>
      <p className="text-lg">Breathe in, breathe out — {activity.cycles} times.</p>
    </div>
  );
}
