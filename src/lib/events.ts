import pack from "@/data/events.json";
import { MAX_EVENTS, type Stimulus } from "@/lib/types";

export const STIMULI = pack as Stimulus[];

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleEvents(n: number, seed: number): Stimulus[] {
  const count = Math.min(MAX_EVENTS, Math.max(1, n), STIMULI.length);
  const copy = [...STIMULI];
  const rng = mulberry32(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = copy[i];
    const swap = copy[j];
    if (current === undefined || swap === undefined) continue;
    copy[i] = swap;
    copy[j] = current;
  }
  return copy.slice(0, count);
}

export function eventCount(durationMs: number, beatMs: number): number {
  return Math.min(MAX_EVENTS, Math.max(1, Math.floor(durationMs / beatMs)));
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
