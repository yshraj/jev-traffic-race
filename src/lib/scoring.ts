import { estimateUsd, JEV_PRICING, type Opponent } from "@/lib/models";
import {
  distanceMetres,
  formatMetres,
  outcomeCounts,
  type RaceStep,
} from "@/lib/race";
import type {
  Label,
  LaneMetrics,
  LaneStatLine,
  RecapCopy,
  Tick,
  Timing,
  TrialResult,
} from "@/lib/types";

export function classifyTiming(
  arrivedAt: number | undefined,
  tBeat: number,
  beatMs: number,
  recapAt: number,
  error?: string,
): Timing {
  if (error && arrivedAt == null) return "error";
  if (arrivedAt == null || arrivedAt > recapAt) return "timeout";
  if (arrivedAt < tBeat + beatMs) return "on_time";
  return "late";
}

export function tickFor(timing: Timing, correct: boolean): Tick {
  if (timing === "timeout" || timing === "error") return "miss";
  if (timing === "late") return "late";
  return correct ? "hit" : "miss";
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const low = sorted[lo];
  const high = sorted[hi];
  if (low === undefined) return null;
  if (hi === lo || high === undefined) return low;
  return low + (high - low) * (idx - lo);
}

export function scoreLane(
  trials: TrialResult[],
  n: number,
  durationS: number,
  beatMs: number,
  recapAt: number,
  pricing: { inputUsdPerMillion: number; outputUsdPerMillion: number },
): LaneMetrics {
  let answered = 0;
  let correct = 0;
  let onTime = 0;
  let late = 0;
  let timeout = 0;
  let error = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  const latencies: number[] = [];
  const confidences: number[] = [];
  const steps: RaceStep[] = [];

  for (const trial of trials) {
    const timing = classifyTiming(
      trial.arrivedAt,
      trial.tBeat,
      beatMs,
      recapAt,
      trial.error,
    );
    const isCorrect = trial.choice !== undefined && trial.choice === trial.gold;
    steps.push({ timing, correct: isCorrect });

    if (timing === "error") {
      error += 1;
    } else if (timing === "timeout") {
      timeout += 1;
    } else {
      answered += 1;
      if (isCorrect) correct += 1;
      if (timing === "on_time") onTime += 1;
      if (timing === "late") late += 1;
      if (trial.latencyMs !== undefined) latencies.push(trial.latencyMs);
    }

    if (trial.usage) {
      inputTokens += trial.usage.inputTokens;
      outputTokens += trial.usage.outputTokens;
    }
    if (trial.confidence !== undefined) confidences.push(trial.confidence);
  }

  // Hazards the run never got to emit still count as a stalled vehicle.
  const unanswered = Math.max(0, n - trials.length);
  timeout += unanswered;
  for (let i = 0; i < unanswered; i++) {
    steps.push({ timing: "timeout", correct: false });
  }

  return {
    n,
    answered,
    correct,
    accuracy: n === 0 ? 0 : correct / n,
    answered_accuracy: answered === 0 ? null : correct / answered,
    on_time: onTime,
    on_time_pct: n === 0 ? 0 : onTime / n,
    late,
    timeout,
    error,
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    answers_per_sec: durationS === 0 ? 0 : answered / durationS,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    est_usd: estimateUsd(
      inputTokens,
      outputTokens,
      pricing.inputUsdPerMillion,
      pricing.outputUsdPerMillion,
    ),
    mean_confidence:
      confidences.length === 0
        ? null
        : confidences.reduce((sum, value) => sum + value, 0) /
          confidences.length,
    distance_m: distanceMetres(steps),
    outcomes: outcomeCounts(steps),
  };
}

export function formatMs(ms: number | null): string {
  if (ms == null) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatUsd(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(3)}`;
}

export function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function statLine(label: string, m: LaneMetrics): LaneStatLine {
  return {
    label,
    p50: formatMs(m.p50_ms),
    onTime: `${m.on_time}/${m.n}`,
    accuracy: formatPct(m.accuracy),
    cost: formatUsd(m.est_usd),
  };
}

function flatten(line: LaneStatLine): string {
  return `${line.label} · ${line.p50} p50 · ${line.onTime} on time · ${line.accuracy} accuracy · ${line.cost}`;
}

export function recapCopy(
  jev: LaneMetrics,
  opp: LaneMetrics,
  oppLabel: string,
): RecapCopy {
  const jevLine = statLine("Jev", jev);
  const oppLine = statLine(oppLabel, opp);

  return {
    jev: jevLine,
    opp: oppLine,
    note: "Jev is not smarter here. It is on time.",
    distance: `Road covered: Jev ${formatMetres(jev.distance_m)}, ${oppLabel} ${formatMetres(opp.distance_m)}.`,
    clipboard: `${flatten(jevLine)}\n${flatten(oppLine)}\nJev is not smarter here. It is on time.`,
  };
}

export function isLabel(value: unknown): value is Label {
  return value === "left" || value === "right" || value === "hold";
}

export function jevPricing() {
  return JEV_PRICING;
}

export function opponentPricing(opponent: Opponent) {
  return {
    inputUsdPerMillion: opponent.inputUsdPerMillion,
    outputUsdPerMillion: opponent.outputUsdPerMillion,
  };
}
