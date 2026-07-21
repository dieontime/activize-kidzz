import { useEffect, useState } from "react";

export type SequenceMemoryPhase = "watching" | "input" | "success";

export interface SequenceMemoryState {
  phase: SequenceMemoryPhase;
  watchIndex: number;
  progress: number;
  submit: (icon: string) => void;
}

export function useSequenceMemory(
  sequence: string[],
  onComplete: () => void,
  opts?: { stepMs?: number; successFlashMs?: number },
): SequenceMemoryState {
  const stepMs = opts?.stepMs ?? 800;
  const successFlashMs = opts?.successFlashMs ?? 600;
  const [phase, setPhase] = useState<SequenceMemoryPhase>("watching");
  const [watchIndex, setWatchIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase !== "watching") return;
    if (watchIndex >= sequence.length) {
      setPhase("input");
      return;
    }
    const timer = setTimeout(() => setWatchIndex((i) => i + 1), stepMs);
    return () => clearTimeout(timer);
  }, [phase, watchIndex, sequence.length, stepMs]);

  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(onComplete, successFlashMs);
    return () => clearTimeout(timer);
  }, [phase, successFlashMs, onComplete]);

  const submit = (icon: string) => {
    if (phase !== "input") return;
    if (icon === sequence[progress]) {
      const next = progress + 1;
      if (next === sequence.length) {
        setPhase("success");
      } else {
        setProgress(next);
      }
    } else {
      setProgress(0);
      setWatchIndex(0);
      setPhase("watching");
    }
  };

  return { phase, watchIndex, progress, submit };
}
