"use client";

import type { Opponent } from "@/lib/models";
import { ALLOWED_DURATIONS_MS, TEMPOS, type TempoId } from "@/lib/types";

type SetupProps = {
  opponents: Opponent[];
  typesafeKey: string;
  opponentKey: string;
  modelId: string;
  durationMs: number;
  tempoId: TempoId;
  busy: boolean;
  error?: string;
  onTypesafeKey: (value: string) => void;
  onOpponentKey: (value: string) => void;
  onModelId: (value: string) => void;
  onDurationMs: (value: number) => void;
  onTempoId: (value: TempoId) => void;
  onStart: () => void;
};

export function Setup({
  opponents,
  typesafeKey,
  opponentKey,
  modelId,
  durationMs,
  tempoId,
  busy,
  error,
  onTypesafeKey,
  onOpponentKey,
  onModelId,
  onDurationMs,
  onTempoId,
  onStart,
}: SetupProps) {
  const ready = typesafeKey.trim().length > 0 && opponentKey.trim().length > 0 && modelId;
  const seconds = durationMs / 1000;
  const tempo = TEMPOS.find((item) => item.id === tempoId) ?? TEMPOS[1];

  return (
    <form
      className="setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !busy) onStart();
      }}
    >
      <div className="field">
        <label htmlFor="jev-key">Jev API key</label>
        <input
          id="jev-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={typesafeKey}
          onChange={(event) => onTypesafeKey(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="opponent">Opponent</label>
        <select
          id="opponent"
          value={modelId}
          onChange={(event) => onModelId(event.target.value)}
        >
          {opponents.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {modelId ? (
        <div className="field">
          <label htmlFor="opp-key">Opponent API key</label>
          <input
            id="opp-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={opponentKey}
            onChange={(event) => onOpponentKey(event.target.value)}
          />
        </div>
      ) : null}
      <div className="field">
        <label>Traffic</label>
        <div className="durations">
          {TEMPOS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === tempoId}
              onClick={() => onTempoId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="field-note">
          {tempo?.note} One hazard every {tempo?.beatMs}ms.
        </p>
      </div>
      <div className="field">
        <label>Duration</label>
        <div className="durations">
          {ALLOWED_DURATIONS_MS.map((ms) => (
            <button
              key={ms}
              type="button"
              aria-pressed={ms === durationMs}
              onClick={() => onDurationMs(ms)}
            >
              {ms / 1000}s
            </button>
          ))}
        </div>
      </div>
      <button className="start" type="submit" disabled={!ready || busy}>
        {busy ? "Checking keys" : `Drive ${seconds} seconds`}
      </button>
      {error ? <p className="err">{error}</p> : null}
      <p className="warn">
        Keys are sent to this demo&apos;s server for the run, then discarded.
      </p>
    </form>
  );
}
