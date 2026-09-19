import { describe, expect, it } from "vitest";
import {
  classifyTiming,
  formatMs,
  percentile,
  recapCopy,
  scoreLane,
  tickFor,
} from "@/lib/scoring";
import type { TrialResult } from "@/lib/types";

const beatMs = 700;
const t0 = 1_000_000;
const recapAt = t0 + 12_000;
const pricing = { inputUsdPerMillion: 0.042, outputUsdPerMillion: 0 };

function trial(
  partial: Partial<TrialResult> & Pick<TrialResult, "beatId" | "gold">,
): TrialResult {
  return {
    tBeat: t0 + partial.beatId * beatMs,
    ...partial,
  };
}

describe("classifyTiming", () => {
  it("marks on-time when the answer lands before the next beat", () => {
    expect(classifyTiming(t0 + 94, t0, beatMs, recapAt)).toBe("on_time");
  });

  it("marks late when the answer lands after the next beat and before recap", () => {
    expect(classifyTiming(t0 + 1400, t0, beatMs, recapAt)).toBe("late");
  });

  it("marks timeout when nothing arrives by recap", () => {
    expect(classifyTiming(undefined, t0, beatMs, recapAt)).toBe("timeout");
    expect(classifyTiming(recapAt + 1, t0, beatMs, recapAt)).toBe("timeout");
  });

  it("marks error when the call failed without an arrival", () => {
    expect(classifyTiming(undefined, t0, beatMs, recapAt, "Overloaded.")).toBe(
      "error",
    );
  });
});

describe("scoreLane", () => {
  it("counts timeouts as wrong for accuracy", () => {
    const trials: TrialResult[] = [
      trial({
        beatId: 0,
        gold: "left",
        choice: "left",
        arrivedAt: t0 + 90,
        latencyMs: 90,
      }),
      trial({
        beatId: 1,
        gold: "right",
        choice: "right",
        arrivedAt: t0 + beatMs + 1400,
        latencyMs: 1400,
      }),
    ];
    const metrics = scoreLane(trials, 3, 12, beatMs, recapAt, pricing);
    expect(metrics.n).toBe(3);
    expect(metrics.answered).toBe(2);
    expect(metrics.correct).toBe(2);
    expect(metrics.accuracy).toBeCloseTo(2 / 3);
    expect(metrics.answered_accuracy).toBe(1);
    expect(metrics.on_time).toBe(1);
    expect(metrics.late).toBe(1);
    expect(metrics.timeout).toBe(1);
  });

  it("computes p50 from sorted latencies", () => {
    const trials: TrialResult[] = [80, 90, 100, 200, 1400].map(
      (latency, beatId) =>
        trial({
          beatId,
          gold: "left",
          choice: "left",
          arrivedAt: t0 + beatId * beatMs + latency,
          latencyMs: latency,
        }),
    );
    const metrics = scoreLane(trials, 5, 12, beatMs, recapAt, pricing);
    expect(metrics.p50_ms).toBe(100);
  });

  it("treats a late wrong answer as answered but not on time", () => {
    const trials: TrialResult[] = [
      trial({
        beatId: 0,
        gold: "hold",
        choice: "left",
        arrivedAt: t0 + 1600,
        latencyMs: 1600,
      }),
    ];
    const metrics = scoreLane(trials, 1, 12, beatMs, recapAt, pricing);
    expect(metrics.answered).toBe(1);
    expect(metrics.correct).toBe(0);
    expect(metrics.accuracy).toBe(0);
    expect(metrics.on_time).toBe(0);
    expect(metrics.late).toBe(1);
  });
});

describe("percentile", () => {
  it("returns null for an empty set", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("interpolates between neighbors", () => {
    expect(percentile([10, 20], 50)).toBe(15);
  });
});

describe("tickFor", () => {
  it("keeps late distinct from hit", () => {
    expect(tickFor("late", true)).toBe("late");
    expect(tickFor("on_time", true)).toBe("hit");
    expect(tickFor("timeout", false)).toBe("miss");
  });
});

describe("recapCopy", () => {
  it("keeps opponent accuracy on screen even when it wins", () => {
    const jev = scoreLane(
      [
        trial({
          beatId: 0,
          gold: "left",
          choice: "right",
          arrivedAt: t0 + 90,
          latencyMs: 90,
        }),
      ],
      1,
      12,
      beatMs,
      recapAt,
      pricing,
    );
    const opp = scoreLane(
      [
        trial({
          beatId: 0,
          gold: "left",
          choice: "left",
          arrivedAt: t0 + 1400,
          latencyMs: 1400,
        }),
      ],
      1,
      12,
      beatMs,
      recapAt,
      { inputUsdPerMillion: 1, outputUsdPerMillion: 5 },
    );
    const copy = recapCopy(jev, opp, "Claude Haiku 4.5");
    expect(copy.opp.accuracy).toBe("100%");
    expect(copy.jev.accuracy).toBe("0%");
    expect(copy.opp.label).toBe("Claude Haiku 4.5");
    expect(copy.note).toBe("Jev is not smarter here. It is on time.");
    // The flat string is clipboard-only; the screen uses the structured grid.
    expect(copy.clipboard).toContain("100% accuracy");
  });
});

describe("formatMs", () => {
  it("uses seconds past 1000ms", () => {
    expect(formatMs(94)).toBe("94ms");
    expect(formatMs(1400)).toBe("1.4s");
  });
});
