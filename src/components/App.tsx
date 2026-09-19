"use client";

import { useEffect, useMemo, useState } from "react";
import { RaceStage, type LaneState } from "@/components/RaceStage";
import { Recap } from "@/components/Recap";
import { Setup } from "@/components/Setup";
import type { Opponent } from "@/lib/models";
import {
  emptyCounts,
  metresFor,
  outcomeFor,
  type Outcome,
} from "@/lib/race";
import { readSse } from "@/lib/sse";
import {
  BEAT_MS,
  DEFAULT_DURATION_MS,
  DEFAULT_TEMPO,
  TEMPOS,
  type Label,
  type LaneMetrics,
  type RecapCopy,
  type TempoId,
  type Timing,
  type Visual,
} from "@/lib/types";

type Phase = "setup" | "idle" | "running" | "recap";

type Prefill = {
  typesafeKey: string;
  opponentKeys: {
    anthropic: string;
    openai: string;
    google: string;
  };
};

type TrialEvent = {
  lane: "jev" | "opp";
  beatId: number;
  latencyMs?: number;
  timing: Timing;
  choice?: Label;
  correct?: boolean;
  error?: string;
};

type RecapEvent = {
  seed: number;
  jev: LaneMetrics;
  opp: LaneMetrics;
  copy: RecapCopy;
};

type AppProps = {
  opponents: Opponent[];
  prefill: Prefill | null;
};

function emptyLane(): LaneState {
  return {
    latencyMs: null,
    distanceM: 0,
    counts: emptyCounts(),
  };
}

function keyForProvider(
  opponents: Opponent[],
  modelId: string,
  keys: Prefill["opponentKeys"],
): string {
  const opponent = opponents.find((item) => item.id === modelId);
  if (!opponent) return "";
  return keys[opponent.provider] ?? "";
}

function formatClock(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  return `00:${String(seconds).padStart(2, "0")}`;
}

function beatMsFor(tempoId: TempoId): number {
  return TEMPOS.find((item) => item.id === tempoId)?.beatMs ?? BEAT_MS;
}

export function App({ opponents, prefill }: AppProps) {
  const defaultModel = opponents[0]?.id ?? "haiku-4.5";
  const initialJev = prefill?.typesafeKey ?? "";
  const initialOpp = prefill
    ? keyForProvider(opponents, defaultModel, prefill.opponentKeys)
    : "";
  const [phase, setPhase] = useState<Phase>(
    initialJev && initialOpp ? "idle" : "setup",
  );
  const [typesafeKey, setTypesafeKey] = useState(initialJev);
  const [modelId, setModelId] = useState(defaultModel);
  const [opponentKey, setOpponentKey] = useState(initialOpp);
  const [durationMs, setDurationMs] = useState(DEFAULT_DURATION_MS);
  const [tempoId, setTempoId] = useState<TempoId>(DEFAULT_TEMPO);
  const [seed, setSeed] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [msLeft, setMsLeft] = useState(DEFAULT_DURATION_MS);
  const [n, setN] = useState(0);
  const [hazard, setHazard] = useState<Visual>();
  const [beatId, setBeatId] = useState<number>();
  const [beatMs, setBeatMs] = useState(beatMsFor(DEFAULT_TEMPO));
  const [jev, setJev] = useState<LaneState>(emptyLane);
  const [opp, setOpp] = useState<LaneState>(emptyLane);
  const [copy, setCopy] = useState<RecapCopy>();
  const [reducedMotion, setReducedMotion] = useState(false);

  const opponent = useMemo(
    () => opponents.find((item) => item.id === modelId) ?? opponents[0],
    [modelId, opponents],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function resetBoard() {
    setJev(emptyLane());
    setOpp(emptyLane());
    setHazard(undefined);
    setBeatId(undefined);
    setCopy(undefined);
    setError(undefined);
  }

  function applyTrial(trial: TrialEvent) {
    const correct = trial.correct ?? false;
    const outcome: Outcome = outcomeFor(trial.timing, correct);
    const gained = metresFor(trial.timing, correct);
    const setLane = trial.lane === "jev" ? setJev : setOpp;

    setLane((current) => ({
      latencyMs: trial.latencyMs ?? current.latencyMs,
      distanceM: current.distanceM + gained,
      counts: { ...current.counts, [outcome]: current.counts[outcome] + 1 },
      lastOutcome: outcome,
      resolvedBeatId: trial.beatId,
      error: trial.error ?? current.error,
    }));
  }

  async function startRun(nextSeed: number | null) {
    setBusy(true);
    setError(undefined);
    const runBeatMs = beatMsFor(tempoId);

    try {
      const ping = await fetch("/api/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typesafeKey, opponentKey, modelId }),
      });
      const pingBody = (await ping.json()) as {
        ok?: boolean;
        jev?: string;
        opponent?: string;
        error?: string;
      };
      if (!ping.ok || !pingBody.ok) {
        setError(
          [pingBody.jev, pingBody.opponent, pingBody.error]
            .filter(Boolean)
            .join(" "),
        );
        setBusy(false);
        return;
      }

      resetBoard();
      setPhase("running");
      setMsLeft(durationMs);
      setBeatMs(runBeatMs);

      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typesafeKey,
          opponentKey,
          modelId,
          durationMs,
          beatMs: runBeatMs,
          seed: nextSeed ?? undefined,
        }),
      });

      if (!response.ok) {
        const failed = (await response.json()) as { error?: string };
        throw new Error(failed.error ?? "Run failed.");
      }

      const startedAt = Date.now();
      const timer = window.setInterval(() => {
        setMsLeft(Math.max(0, durationMs - (Date.now() - startedAt)));
      }, 100);

      await readSse(response, (event, data) => {
        if (event === "start") {
          const start = data as { n: number; seed: number; beatMs: number };
          setN(start.n);
          setSeed(start.seed);
          setBeatMs(start.beatMs);
        }
        if (event === "beat") {
          const beat = data as { beatId: number; visual: Visual };
          setBeatId(beat.beatId);
          setHazard(beat.visual);
        }
        if (event === "trial") {
          applyTrial(data as TrialEvent);
        }
        if (event === "recap") {
          const recap = data as RecapEvent;
          setCopy(recap.copy);
          setSeed(recap.seed);
          setN(recap.jev.n);
          // Settle on the server's figures so partial SSE never skews the board.
          setJev((current) => ({
            ...current,
            distanceM: recap.jev.distance_m,
            counts: recap.jev.outcomes,
          }));
          setOpp((current) => ({
            ...current,
            distanceM: recap.opp.distance_m,
            counts: recap.opp.outcomes,
          }));
          setPhase("recap");
        }
        if (event === "error") {
          const payload = data as { message?: string };
          setError(payload.message ?? "Run failed.");
        }
      });

      window.clearInterval(timer);
      setMsLeft(0);
    } catch (err) {
      setPhase("setup");
      setError(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <div className="shell">
        <header className="topbar">
          <div>
            <div className="brand">Jev Reflex</div>
            <p className="sub">Same road. Same hazard. Different clocks.</p>
          </div>
          <div className="clock">
            {formatClock(phase === "setup" ? durationMs : msLeft)}
            {phase === "running" ? (
              <span className="live">
                <span className="live-dot" />
                LIVE
              </span>
            ) : null}
            {phase === "idle" ? (
              <span className="live live-idle">IDLE</span>
            ) : null}
          </div>
          <div className="opp-name">opponent: {opponent?.label ?? "-"}</div>
        </header>
        <p className="mobile-note">
          Record this on a desktop. The two roads need width.
        </p>

        {phase === "setup" ? (
          <Setup
            opponents={opponents}
            typesafeKey={typesafeKey}
            opponentKey={opponentKey}
            modelId={modelId}
            durationMs={durationMs}
            tempoId={tempoId}
            busy={busy}
            error={error}
            onTypesafeKey={setTypesafeKey}
            onOpponentKey={setOpponentKey}
            onModelId={(value) => {
              setModelId(value);
              if (prefill) {
                setOpponentKey(
                  keyForProvider(opponents, value, prefill.opponentKeys),
                );
              }
            }}
            onDurationMs={setDurationMs}
            onTempoId={setTempoId}
            onStart={() => void startRun(null)}
          />
        ) : (
          <>
            <RaceStage
              opponentLabel={opponent?.label ?? "Opponent"}
              jev={jev}
              opp={opp}
              hazard={hazard}
              beatId={beatId}
              beatMs={beatMs}
              n={n}
              reducedMotion={reducedMotion}
            />
            {phase === "idle" ? (
              <div className="recap-actions">
                <button
                  className="start start-inline"
                  type="button"
                  disabled={busy}
                  onClick={() => void startRun(null)}
                >
                  {busy ? "Checking keys" : `Drive ${durationMs / 1000} seconds`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetBoard();
                    setPhase("setup");
                  }}
                >
                  Change keys
                </button>
              </div>
            ) : null}
            {phase === "recap" && copy ? (
              <Recap
                copy={copy}
                seed={seed}
                onReplay={() => void startRun(seed)}
                onNewRoad={() => void startRun(null)}
                onChangeModel={() => {
                  resetBoard();
                  setPhase("setup");
                }}
              />
            ) : null}
            {error ? <p className="err">{error}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
