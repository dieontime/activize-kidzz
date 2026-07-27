import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function PageShell({ children }: Props) {
  return (
    <div className="min-h-screen relative overflow-hidden text-storybook-ink font-sans bg-linear-to-b from-[#4CAF78] to-storybook-cream">
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="absolute -top-8 -right-8 w-36 h-24 rounded-bl-full rounded-tr-full bg-linear-to-br from-[#3D8361] to-storybook-cream opacity-40 rotate-12" />
        <div className="absolute top-4 right-10 w-24 h-16 rounded-bl-full rounded-tr-full bg-linear-to-br from-[#4CAF78] to-[#2E6D50] opacity-30 -rotate-6" />
        <div className="absolute -bottom-10 -left-10 w-40 h-28 rounded-tr-full rounded-bl-full bg-linear-to-tl from-[#2E5D48] to-storybook-cream opacity-40 -rotate-12" />
        <div className="absolute top-0 left-[30%] w-1.5 h-28 rounded-full bg-linear-to-b from-[#4CAF78] to-[#2E6D50] opacity-30 rotate-6" />
        <div className="absolute top-0 left-[60%] w-1.5 h-20 rounded-full bg-linear-to-b from-[#4CAF78] to-[#2E6D50] opacity-30 -rotate-6" />
        <div className="absolute top-[35%] left-[20%] w-1.5 h-1.5 rounded-full bg-storybook-gold shadow-[0_0_8px_3px_rgba(255,201,60,0.6)]" />
        <div className="absolute top-[55%] left-[75%] w-1.5 h-1.5 rounded-full bg-storybook-gold shadow-[0_0_8px_3px_rgba(255,201,60,0.6)]" />
      </div>
      <div className="relative z-10 p-8">
        {children}
      </div>
    </div>
  );
}
