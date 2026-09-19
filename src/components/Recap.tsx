"use client";

import { useState } from "react";
import type { LaneStatLine, RecapCopy } from "@/lib/types";

type RecapProps = {
  copy: RecapCopy;
  seed: number | null;
  onReplay: () => void;
  onNewRoad: () => void;
  onChangeModel: () => void;
};

function StatRow({ line, lane }: { line: LaneStatLine; lane: "jev" | "opp" }) {
  return (
    <div className={`stat-row stat-${lane}`}>
      <div className="stat-name">{line.label}</div>
      <div className="stat-cell">
        <span className="stat-key">p50</span>
        <span className="stat-value">{line.p50}</span>
      </div>
      <div className="stat-cell">
        <span className="stat-key">on time</span>
        <span className="stat-value">{line.onTime}</span>
      </div>
      <div className="stat-cell">
        <span className="stat-key">accuracy</span>
        <span className="stat-value">{line.accuracy}</span>
      </div>
      <div className="stat-cell">
        <span className="stat-key">cost</span>
        <span className="stat-value">{line.cost}</span>
      </div>
    </div>
  );
}

export function Recap({
  copy,
  seed,
  onReplay,
  onNewRoad,
  onChangeModel,
}: RecapProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(copy.clipboard);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="recap">
      <div className="stats">
        <StatRow line={copy.jev} lane="jev" />
        <StatRow line={copy.opp} lane="opp" />
      </div>
      <div className="recap-note">{copy.note}</div>
      <p className="recap-distance">
        {copy.distance} Metres are the game readout, scored from the latency and
        correctness above.
      </p>
      <div className="recap-actions">
        <button type="button" onClick={onReplay}>
          Replay same road
        </button>
        <button type="button" onClick={onNewRoad}>
          New road
        </button>
        <button type="button" onClick={onChangeModel}>
          Change model
        </button>
        <button type="button" onClick={onCopy}>
          {copied ? "Copied" : "Copy stats"}
        </button>
      </div>
      {seed !== null ? <p className="recap-seed">seed {seed}</p> : null}
    </section>
  );
}
