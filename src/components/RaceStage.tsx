"use client";

import { Road } from "@/components/Road";
import {
  formatMetres,
  leadMetres,
  maxMetres,
  type Outcome,
  type OutcomeCounts,
} from "@/lib/race";
import type { Visual } from "@/lib/types";

export type LaneState = {
  latencyMs: number | null;
  distanceM: number;
  counts: OutcomeCounts;
  lastOutcome?: Outcome;
  resolvedBeatId?: number;
  error?: string;
};

type RaceStageProps = {
  opponentLabel: string;
  jev: LaneState;
  opp: LaneState;
  hazard?: Visual;
  beatId?: number;
  beatMs: number;
  n: number;
  reducedMotion: boolean;
};

export function RaceStage({
  opponentLabel,
  jev,
  opp,
  hazard,
  beatId,
  beatMs,
  n,
  reducedMotion,
}: RaceStageProps) {
  // One scale for both roads, so the gap on screen is the gap in metres.
  const maxM = maxMetres(n);
  const lead = leadMetres(jev.distanceM, opp.distanceM);
  const leader = lead === 0 ? null : lead > 0 ? "jev" : "opp";

  return (
    <div className="race">
      <Road
        lane="jev"
        name="Jev"
        caption="decision model · no text out"
        latencyMs={jev.latencyMs}
        distanceM={jev.distanceM}
        maxM={maxM}
        counts={jev.counts}
        lastOutcome={jev.lastOutcome}
        resolvedBeatId={jev.resolvedBeatId}
        hazard={hazard}
        beatId={beatId}
        beatMs={beatMs}
        reducedMotion={reducedMotion}
        error={jev.error}
      />
      <Road
        lane="opp"
        name={opponentLabel}
        latencyMs={opp.latencyMs}
        distanceM={opp.distanceM}
        maxM={maxM}
        counts={opp.counts}
        lastOutcome={opp.lastOutcome}
        resolvedBeatId={opp.resolvedBeatId}
        hazard={hazard}
        beatId={beatId}
        beatMs={beatMs}
        reducedMotion={reducedMotion}
        error={opp.error}
      />
      {leader === null ? (
        <p className="race-lead">Level. Neither driver is ahead.</p>
      ) : (
        <p className={`race-lead race-lead-${leader}`}>
          <strong>{leader === "jev" ? "Jev" : opponentLabel}</strong> leads by{" "}
          <strong>{formatMetres(Math.abs(lead))}</strong>.
        </p>
      )}
    </div>
  );
}
