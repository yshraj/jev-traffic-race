import type { OutcomeCounts } from "@/lib/race";

export type Label = "left" | "right" | "hold";

export type HazardKind = "clear" | "conflict" | "fake" | "edge";

export type HazardId =
  | "pothole"
  | "shadow"
  | "bag"
  | "cement"
  | "rickshaw"
  | "truck"
  | "bus"
  | "bike"
  | "cow"
  | "dog"
  | "pedestrian"
  | "cone"
  | "barricade";

export type Visual = {
  /** Which side of the road is open. */
  gap: "left" | "right" | "none";
  /** Which hazard glyph to draw. */
  hazard: HazardId;
  /** A painted or signed cue that may disagree with the gap. */
  marking: "none" | "paint" | "sign";
  /** The hazard looks real but is not. */
  fake: boolean;
};

export type Stimulus = {
  id: string;
  gold: Label;
  kind: HazardKind;
  cue: string;
  notes: string;
  visual: Visual;
};

export type Lane = "jev" | "opp";

export type Timing = "on_time" | "late" | "timeout" | "error";

export type Tick = "hit" | "miss" | "late" | "pending";

export type Usage = {
  inputTokens: number;
  outputTokens: number;
};

export type TrialResult = {
  beatId: number;
  tBeat: number;
  arrivedAt?: number;
  latencyMs?: number;
  choice?: Label;
  gold: Label;
  confidence?: number;
  error?: string;
  usage?: Usage;
};

export type LaneMetrics = {
  n: number;
  answered: number;
  correct: number;
  accuracy: number;
  answered_accuracy: number | null;
  on_time: number;
  on_time_pct: number;
  late: number;
  timeout: number;
  error: number;
  p50_ms: number | null;
  p95_ms: number | null;
  answers_per_sec: number;
  input_tokens: number;
  output_tokens: number;
  est_usd: number;
  mean_confidence: number | null;
  /** Game readout, derived from timing and correctness. Not a benchmark. */
  distance_m: number;
  outcomes: OutcomeCounts;
};

export type LaneStatLine = {
  label: string;
  p50: string;
  onTime: string;
  accuracy: string;
  cost: string;
};

export type RecapCopy = {
  jev: LaneStatLine;
  opp: LaneStatLine;
  note: string;
  distance: string;
  /** Flat text for pasting elsewhere, where a grid is not available. */
  clipboard: string;
};

export const LABELS: Label[] = ["left", "right", "hold"];

export type TempoId = "rush" | "peak" | "monsoon";

export type Tempo = {
  id: TempoId;
  label: string;
  beatMs: number;
  note: string;
};

export const TEMPOS: Tempo[] = [
  {
    id: "rush",
    label: "Rush hour",
    beatMs: 1200,
    note: "Both keep up. Accuracy is the story.",
  },
  {
    id: "peak",
    label: "Peak traffic",
    beatMs: 700,
    note: "Jev stays on beat. The opponent starts slipping.",
  },
  {
    id: "monsoon",
    label: "Monsoon",
    beatMs: 400,
    note: "The opponent backlog is unmissable.",
  },
];

export const DEFAULT_TEMPO: TempoId = "peak";

export const BEAT_MS = 700;
export const ALLOWED_BEAT_MS: number[] = TEMPOS.map((tempo) => tempo.beatMs);

export const DEFAULT_DURATION_MS = 12_000;
export const ALLOWED_DURATIONS_MS = [10_000, 12_000, 15_000] as const;
export const MAX_EVENTS = 30;
export const ABORT_AFTER_FAILS = 5;
