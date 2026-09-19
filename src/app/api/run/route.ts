import { eventCount, randomSeed, sampleEvents } from "@/lib/events";
import { isAbortError, providerMessage } from "@/lib/errors";
import { callJev, createJevClient } from "@/lib/jev";
import { callOpponent, requireOpponent } from "@/lib/opponent";
import { toModelState } from "@/lib/questions";
import { allowRun, clientIp } from "@/lib/rate-limit";
import {
  classifyTiming,
  jevPricing,
  opponentPricing,
  recapCopy,
  scoreLane,
  tickFor,
} from "@/lib/scoring";
import {
  ABORT_AFTER_FAILS,
  ALLOWED_BEAT_MS,
  ALLOWED_DURATIONS_MS,
  BEAT_MS,
  DEFAULT_DURATION_MS,
  type Lane,
  type Stimulus,
  type TrialResult,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type RunBody = {
  typesafeKey?: string;
  opponentKey?: string;
  modelId?: string;
  durationMs?: number;
  beatMs?: number;
  seed?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAllowedDuration(value: number): boolean {
  return (ALLOWED_DURATIONS_MS as readonly number[]).includes(value);
}

export async function POST(request: Request) {
  if (!allowRun(clientIp(request.headers))) {
    return new Response(JSON.stringify({ error: "Too many runs. Wait a few minutes." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: RunBody;
  try {
    body = (await request.json()) as RunBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const typesafeKey = body.typesafeKey?.trim() ?? "";
  const opponentKey = body.opponentKey?.trim() ?? "";
  const modelId = body.modelId?.trim() ?? "";
  const durationMs = body.durationMs ?? DEFAULT_DURATION_MS;
  const beatMs = body.beatMs ?? BEAT_MS;
  const seed =
    typeof body.seed === "number" && Number.isFinite(body.seed)
      ? Math.floor(body.seed)
      : randomSeed();

  if (!typesafeKey || !opponentKey || !modelId) {
    return new Response(JSON.stringify({ error: "Both keys and an opponent are required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isAllowedDuration(durationMs)) {
    return new Response(JSON.stringify({ error: "Duration must be 10, 12, or 15 seconds." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ALLOWED_BEAT_MS.includes(beatMs)) {
    return new Response(JSON.stringify({ error: "Unknown traffic setting." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let opponent;
  try {
    opponent = requireOpponent(modelId);
  } catch {
    return new Response(JSON.stringify({ error: "Unknown opponent." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const n = eventCount(durationMs, beatMs);
  const events = sampleEvents(n, seed);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      const t0 = Date.now();
      const recapAt = t0 + durationMs;
      const jevTrials: TrialResult[] = [];
      const oppTrials: TrialResult[] = [];
      const pending: Promise<void>[] = [];
      const emitted = new Set<string>();
      const jevAbort = new AbortController();
      const oppAbort = new AbortController();
      const jevClient = createJevClient(typesafeKey);
      let jevFails = 0;
      let oppFails = 0;

      send("start", {
        seed,
        durationMs,
        beatMs,
        n,
        opponent: { id: opponent.id, label: opponent.label },
      });

      const emitTrial = (
        lane: Lane,
        event: Stimulus,
        beatId: number,
        tBeat: number,
        result: Partial<TrialResult>,
      ) => {
        const key = `${lane}:${beatId}`;
        if (emitted.has(key)) return;
        emitted.add(key);

        const trial: TrialResult = {
          beatId,
          tBeat,
          gold: event.gold,
          ...result,
        };
        const bucket = lane === "jev" ? jevTrials : oppTrials;
        bucket.push(trial);

        const timing = classifyTiming(
          trial.arrivedAt,
          trial.tBeat,
          beatMs,
          recapAt,
          trial.error,
        );
        const correct = trial.choice === event.gold;
        send("trial", {
          lane,
          beatId,
          tBeat,
          latencyMs: trial.latencyMs,
          timing,
          tick: tickFor(timing, correct),
          choice: trial.choice,
          gold: event.gold,
          correct,
          confidence: lane === "jev" ? trial.confidence : undefined,
          error: trial.error,
        });
      };

      const fireLane = (
        lane: Lane,
        event: Stimulus,
        beatId: number,
        tBeat: number,
      ) => {
        const fails = lane === "jev" ? jevFails : oppFails;
        if (fails >= ABORT_AFTER_FAILS) {
          emitTrial(lane, event, beatId, tBeat, {
            error: "aborted after repeated failures",
          });
          return;
        }

        const work = (async () => {
          try {
            const answer =
              lane === "jev"
                ? await callJev(jevClient, toModelState(event), jevAbort.signal)
                : await callOpponent(
                    opponent,
                    opponentKey,
                    toModelState(event),
                    oppAbort.signal,
                  );
            const arrivedAt = Date.now();
            emitTrial(lane, event, beatId, tBeat, {
              arrivedAt,
              latencyMs: answer.latencyMs,
              choice: answer.choice,
              confidence: answer.confidence,
              usage: answer.usage,
            });
          } catch (err) {
            if (isAbortError(err) && Date.now() >= recapAt) {
              emitTrial(lane, event, beatId, tBeat, {});
              if (lane === "jev") jevFails += 1;
              else oppFails += 1;
              return;
            }
            emitTrial(lane, event, beatId, tBeat, {
              error: providerMessage(err, lane),
            });
            if (lane === "jev") jevFails += 1;
            else oppFails += 1;
          }
        })();

        pending.push(work);
      };

      try {
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          if (!event) continue;
          const tBeat = Date.now();
          send("beat", {
            beatId: i,
            tBeat,
            id: event.id,
            visual: event.visual,
            cue: event.cue,
          });
          fireLane("jev", event, i, tBeat);
          fireLane("opp", event, i, tBeat);

          const nextAt = t0 + (i + 1) * beatMs;
          await sleep(Math.max(0, nextAt - Date.now()));
        }

        await sleep(Math.max(0, recapAt - Date.now()));
        jevAbort.abort();
        oppAbort.abort();
        await Promise.allSettled(pending);

        const durationS = durationMs / 1000;
        const jev = scoreLane(
          jevTrials,
          n,
          durationS,
          beatMs,
          recapAt,
          jevPricing(),
        );
        const opp = scoreLane(
          oppTrials,
          n,
          durationS,
          beatMs,
          recapAt,
          opponentPricing(opponent),
        );

        send("recap", {
          seed,
          durationMs,
          beatMs,
          n,
          jev,
          opp,
          copy: recapCopy(jev, opp, opponent.label),
          opponent: { id: opponent.id, label: opponent.label },
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Run failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
