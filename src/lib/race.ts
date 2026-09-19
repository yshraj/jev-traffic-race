import type { Timing } from "@/lib/types";

/**
 * How a single hazard went for one driver.
 *
 * This is a presentation layer over the real measurements. Nothing here feeds
 * accuracy, latency or cost; those stay exactly as the providers reported them.
 */
export type Outcome = "clean" | "clipped" | "hit" | "stalled";

export type OutcomeCounts = {
  clean: number;
  clipped: number;
  hit: number;
  stalled: number;
};

export type RaceStep = {
  timing: Timing;
  correct: boolean;
};

/** Metres gained per hazard. A display convention, labeled as such on screen. */
export const METRES: Record<Outcome, number> = {
  clean: 100,
  clipped: 45,
  hit: 20,
  stalled: 0,
};

export function outcomeFor(timing: Timing, correct: boolean): Outcome {
  if (timing === "timeout" || timing === "error") return "stalled";
  if (!correct) return "hit";
  if (timing === "late") return "clipped";
  return "clean";
}

export function metresFor(timing: Timing, correct: boolean): number {
  return METRES[outcomeFor(timing, correct)];
}

export function distanceMetres(steps: RaceStep[]): number {
  return steps.reduce(
    (total, step) => total + metresFor(step.timing, step.correct),
    0,
  );
}

export function emptyCounts(): OutcomeCounts {
  return { clean: 0, clipped: 0, hit: 0, stalled: 0 };
}

export function outcomeCounts(steps: RaceStep[]): OutcomeCounts {
  const counts = emptyCounts();
  for (const step of steps) {
    counts[outcomeFor(step.timing, step.correct)] += 1;
  }
  return counts;
}

/** Positive when `a` is ahead. */
export function leadMetres(a: number, b: number): number {
  return a - b;
}

/** Best distance a driver could reach over `n` hazards. */
export function maxMetres(n: number): number {
  return n * METRES.clean;
}

export function formatMetres(metres: number): string {
  return `${Math.round(metres).toLocaleString("en-US")} m`;
}
