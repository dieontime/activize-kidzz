import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PageShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-storybook-cream text-storybook-ink font-sans p-8">
      {children}
    </div>
  );
}
