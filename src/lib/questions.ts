export const CALL_INSTRUCTIONS =
  "You are driving. What should the driver do for this hazard? Use `cue` and `notes`. If the painted markings disagree with the open side, or the hazard is not real, hold the line.";

export const CALL_CRITERIA = {
  left: "Swerve left. The hazard is real and the left side of the road is open.",
  right:
    "Swerve right. The hazard is real and the right side of the road is open.",
  hold: "Hold the line. Do not swerve. The markings disagree with the open side, neither side is open, or the hazard is not real.",
} as const;

export const EVAL_QUESTIONS = {
  call: {
    type: "choice" as const,
    instructions: CALL_INSTRUCTIONS,
    criteria: CALL_CRITERIA,
  },
};

export type ModelState = {
  event_id: string;
  cue: string;
  notes: string;
};

export function toModelState(event: {
  id: string;
  cue: string;
  notes: string;
}): ModelState {
  return {
    event_id: event.id,
    cue: event.cue,
    notes: event.notes,
  };
}
