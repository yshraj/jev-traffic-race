import { describe, expect, it } from "vitest";
import {
  METRES,
  distanceMetres,
  leadMetres,
  maxMetres,
  metresFor,
  outcomeCounts,
  outcomeFor,
  type RaceStep,
} from "@/lib/race";

describe("outcomeFor", () => {
  it("maps a correct on-time call to a clean dodge", () => {
    expect(outcomeFor("on_time", true)).toBe("clean");
  });

  it("maps a correct late call to a clip", () => {
    expect(outcomeFor("late", true)).toBe("clipped");
  });

  it("maps any wrong answer to a hit", () => {
    expect(outcomeFor("on_time", false)).toBe("hit");
    expect(outcomeFor("late", false)).toBe("hit");
  });

  it("maps a timeout or provider error to a stall", () => {
    expect(outcomeFor("timeout", false)).toBe("stalled");
    expect(outcomeFor("error", false)).toBe("stalled");
  });
});

describe("distanceMetres", () => {
  it("gives a perfect lane the full distance", () => {
    const steps: RaceStep[] = Array.from({ length: 17 }, () => ({
      timing: "on_time" as const,
      correct: true,
    }));
    expect(distanceMetres(steps)).toBe(maxMetres(17));
    expect(distanceMetres(steps)).toBe(1700);
  });

  it("gives a stalled hazard nothing", () => {
    expect(distanceMetres([{ timing: "timeout", correct: false }])).toBe(0);
    expect(distanceMetres([{ timing: "error", correct: false }])).toBe(0);
  });

  it("rewards a late but correct call over a fast but wrong one", () => {
    const late = distanceMetres([{ timing: "late", correct: true }]);
    const wrong = distanceMetres([{ timing: "on_time", correct: false }]);
    expect(late).toBeGreaterThan(wrong);
  });

  it("still puts an on-time correct call ahead of a late one", () => {
    expect(metresFor("on_time", true)).toBeGreaterThan(metresFor("late", true));
  });

  it("is empty for no steps", () => {
    expect(distanceMetres([])).toBe(0);
  });
});

describe("outcomeCounts", () => {
  it("buckets every step exactly once", () => {
    const steps: RaceStep[] = [
      { timing: "on_time", correct: true },
      { timing: "on_time", correct: true },
      { timing: "late", correct: true },
      { timing: "on_time", correct: false },
      { timing: "timeout", correct: false },
    ];
    const counts = outcomeCounts(steps);
    expect(counts).toEqual({ clean: 2, clipped: 1, hit: 1, stalled: 1 });
    const total = counts.clean + counts.clipped + counts.hit + counts.stalled;
    expect(total).toBe(steps.length);
  });
});

describe("leadMetres", () => {
  it("is positive when the first lane is ahead", () => {
    expect(leadMetres(1400, 620)).toBe(780);
  });

  it("is symmetric", () => {
    expect(leadMetres(620, 1400)).toBe(-leadMetres(1400, 620));
  });

  it("is zero for a dead heat", () => {
    expect(leadMetres(900, 900)).toBe(0);
  });
});

describe("METRES", () => {
  it("is ordered clean, clipped, hit, stalled", () => {
    expect(METRES.clean).toBeGreaterThan(METRES.clipped);
    expect(METRES.clipped).toBeGreaterThan(METRES.hit);
    expect(METRES.hit).toBeGreaterThan(METRES.stalled);
  });
});
