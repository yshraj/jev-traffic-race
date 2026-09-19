import { describe, expect, it } from "vitest";
import { DEADLINE_FRACTION, LATE_WINDOW_MS, trackFraction } from "@/lib/track";

const beatMs = 700;

describe("trackFraction", () => {
  it("is linear in time before the deadline", () => {
    const half = trackFraction(350, beatMs);
    const full = trackFraction(700, beatMs);
    expect(half).toBeCloseTo(DEADLINE_FRACTION / 2);
    expect(full).toBeCloseTo(DEADLINE_FRACTION);
  });

  it("puts a fast answer near the launch pad", () => {
    expect(trackFraction(90, beatMs)).toBeLessThan(0.1);
  });

  it("puts a late answer past the deadline", () => {
    expect(trackFraction(1400, beatMs)).toBeGreaterThan(DEADLINE_FRACTION);
  });

  it("keeps a very slow answer on screen", () => {
    const far = trackFraction(beatMs + LATE_WINDOW_MS * 4, beatMs);
    expect(far).toBeLessThanOrEqual(0.985);
    expect(far).toBeGreaterThan(0.9);
  });

  it("ranks two answers by speed", () => {
    expect(trackFraction(94, beatMs)).toBeLessThan(trackFraction(1420, beatMs));
  });

  it("handles a zero or missing latency", () => {
    expect(trackFraction(0, beatMs)).toBe(0);
    expect(trackFraction(Number.NaN, beatMs)).toBe(0);
  });
});
