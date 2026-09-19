/** Where the deadline line sits across the track, as a fraction of its width. */
export const DEADLINE_FRACTION = 0.68;

/** How far past the deadline an answer can land before it pins to the far end. */
export const LATE_WINDOW_MS = 1800;

const MAX_FRACTION = 0.985;

/**
 * Position on the track for an answer, as a fraction of track width.
 *
 * Before the deadline the mapping is linear in time, so the gap between two
 * pins is the latency difference. Past the deadline it compresses so a very
 * slow answer still lands on screen.
 */
export function trackFraction(latencyMs: number, beatMs: number): number {
  if (!Number.isFinite(latencyMs) || latencyMs <= 0) return 0;
  if (!Number.isFinite(beatMs) || beatMs <= 0) return MAX_FRACTION;

  if (latencyMs <= beatMs) {
    return (latencyMs / beatMs) * DEADLINE_FRACTION;
  }

  const over = Math.min(1, (latencyMs - beatMs) / LATE_WINDOW_MS);
  return Math.min(
    MAX_FRACTION,
    DEADLINE_FRACTION + over * (1 - DEADLINE_FRACTION),
  );
}

/** Pin position for an answer that never arrived. */
export function missedFraction(): number {
  return 0.92;
}
