import type { RendererProps } from "@/content/types";

export function PlaceholderRenderer(_: RendererProps) {
  return (
    <div className="text-center">
      <div className="text-6xl mb-4">✨</div>
      <p className="text-lg">Ask a parent to help you do this one!</p>
    </div>
  );
}
