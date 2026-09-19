# Jev Reflex — End-to-End Plan

**Status:** research only. Do not build until this plan is approved.  
**Repo:** `/Users/yash.d/code/jev-reflex`  
**Product one-liner:** A 12-second split-screen simulation where Jev and one selected LLM classify the same incoming events. The viewer sees speed and accuracy, not a claim that Jev can do everything.

---

## 0. What we are proving

Jev (TypeSafe, `jev-1.13.0` / alias `jev-latest`) is a **System One model**. It does not write text. You send `state` + typed questions; it returns structured answers with probabilities in roughly **70–500ms** (most calls ~100ms from US West). Input is **$0.042 / million tokens**; output is free.

The LinkedIn-ready insight:

> At 1 decision/sec, a current LLM can be as accurate or more accurate.  
> At loop speed, Jev is the one still answering on time.

We will **not** claim: Jev is smarter, Jev replaces Claude/GPT, Jev can explain, Jev can generate, or “only Jev can play this.”

We **will** show, live:

| Axis | How it appears |
|---|---|
| Speed | p50 / p95 latency, answers/sec, on-time % |
| Accuracy | correct vs gold label |
| Cost | tokens + estimated USD for the run |
| Honesty | opponent may win accuracy at Slow; Jev wins on-time |

---

## 1. Product loop (what the user does)

```
[Setup]  paste keys → pick opponent from our list → Start
   │
   ▼
[Run]    12 seconds. Center stream of events. Left = Jev. Right = opponent.
         Beats keep firing even if the opponent is still thinking.
   │
   ▼
[Recap]  scorecard: latency, accuracy, on-time, cost. One sentence, no trophy.
         Replay / change model / copy stats for LinkedIn.
```

Default duration: **12 seconds**. Allow 10 or 15 in a small control, but do not make duration the hero. The hero is the two lanes.

---

## 2. Simulation design

### 2.1 What the human sees vs what models receive

Models **cannot see pixels**. Jev is text-only (string / JSON / array). Images are unsupported.

- **Visual (for humans):** two stacked roads on one shared distance axis. Jev drives the top road, the opponent the bottom. A hazard closes on both vehicles every beat. Decide in time and the vehicle swerves clean, decide late and it clips, decide wrong and it goes in.
- **State (for both models, identical):** a short JSON blob describing that hazard. Gold label is known in our dataset and **never sent** to the models.

Example state:

```json
{
  "event_id": "h21",
  "cue": "A pothole sits in the middle of the road. A painted arrow on the road points right. An auto rickshaw fills the right side.",
  "notes": "The painted arrow disagrees with the open side, and the right side is blocked. Hold the line."
}
```

Question (same for both models):

```json
{
  "call": {
    "type": "choice",
    "instructions": "You are driving. What should the driver do for this hazard? Use `cue` and `notes`. If the painted markings disagree with the open side, or the hazard is not real, hold the line.",
    "criteria": {
      "left": "Swerve left. The hazard is real and the left side of the road is open.",
      "right": "Swerve right. The hazard is real and the right side of the road is open.",
      "hold": "Hold the line. Do not swerve. The markings disagree with the open side, neither side is open, or the hazard is not real."
    }
  }
}
```

This is a real Jev-shaped task (Choice over a closed set) wrapped in a two lane driving visual. It is not ping-pong, Doom, or Wikiracing.

**Distance is a readout, not a claim.** Metres come from a fixed table in `src/lib/race.ts`: clean dodge 100, clipped 45, hit 20, stalled 0. The inputs are the real measured timing and the real correctness. Nothing about latency, accuracy or cost is altered by it, and the recap leads with those numbers, not the metres.

### 2.2 Tempo (this is the product)

Do **not** hide the stimulus at 150ms and call the LLM a failure. That is UI cheating.

Keep the hazard visible. Fire the next beat on a clock. Late answers still count, tagged **LATE** and scored as a clip.

Shipped as a **Traffic** selector on the setup screen:

| Setting | Beat | Hazards in 12s | Expected picture |
|---|---|---|---|
| Rush hour | 1200ms | ~10 | Both keep up. Accuracy is the story. |
| **Peak traffic (default)** | **700ms** | **~17** | Jev stays on beat. Cheap LLM starts slipping. |
| Monsoon | 400ms | ~30 | Jev mostly on time. Opponent backlog is obvious. |

`MAX_EVENTS` is 30 so Monsoon fills a full 12 seconds. The abort-after-5-failures guard in 5.6 still caps a broken run.

Clock rule: the next event starts whether or not the opponent has answered. Jev and opponent are fired **in parallel** at beat start. Never serialize “wait for both.”

### 2.3 Scoring (compute on the server, render on the recap)

Per model, over the run:

| Metric | Definition |
|---|---|
| `n` | events fired |
| `answered` | responses that returned before recap |
| `correct` | answer == gold |
| `accuracy` | `correct / n` (timeouts count as wrong) |
| `answered_accuracy` | `correct / answered` (shown as secondary) |
| `on_time` | answer arrived before the next beat |
| `on_time_pct` | `on_time / n` |
| `late` | answered after next beat, before recap |
| `timeout` | no answer by recap |
| `p50_ms`, `p95_ms` | server-side round trip |
| `answers_per_sec` | `answered / duration_s` |
| `input_tokens`, `output_tokens` | from provider `usage` |
| `est_usd` | tokens × published rates |
| `mean_confidence` | Jev Choice `confidence` only; hide for LLMs |

**Recap copy (template, fill with real numbers):**

> Jev · 94ms p50 · 16/17 on time · 82% accuracy · $0.0003  
> Claude Haiku · 1.4s p50 · 4/17 on time · 88% accuracy · $0.021  
> Jev is not smarter here. It is on time.

If the opponent wins accuracy, **leave it on screen**. That is the honest post.

### 2.4 Hazard pack

Hand-author **40 labeled hazards** in `src/data/events.json`.

Mix:

- Clear swerve left / clear swerve right, one side blocked and the other open (20)
- Painted arrow or sign disagrees with the open side, so `hold` (10)
- Hazard that is not real, a bag, a shadow, a tar seam, so `hold` (6)
- Ambiguous-but-labeled edge cases (4) so neither model is 100%

That keeps `hold` at roughly 45% of gold labels, the same share the old `decoy` had, so runs stay comparable.

Rules for writing `cue` + `notes`:

- Literal. Jev 1.13 is literal and weak at indirection (official jaggedness doc).
- No counting, no date math, no hex colors as the decision (Jev is bad at those).
- Use English color names, not `#ff0000`.
- Gold labels reviewed by a human once. Do not generate labels from Jev.

Sample 17 events per run without replacement. Seed the shuffle so a Replay with the same seed is identical (useful for recording).

---

## 3. Setup screen

### 3.1 Fields

1. **Jev API key** — TypeSafe bearer key from `console.typesafe.ai/settings/keys` (early access / waitlist at typesafe.ai). Env name: `TYPESAFE_API_KEY`.
2. **Opponent** — dropdown from **our** curated list (not a free-text model id).
3. **Opponent API key** — shown after a model is picked; provider inferred from the pick.
4. **Start** — disabled until both keys look non-empty.

Optional later: a single **Vercel AI Gateway** key that can call `typesafe-ai/jev` *and* the opponent. Nice, not v1. Most people with Jev access have a TypeSafe key, not a Gateway key.

Keys live in **React state for the tab session only**. Never `localStorage`. Never logs. Never query params.

### 3.2 Opponent list (v1)

Left lane is always Jev (`jev-latest`). Right lane is one of:

| id | Label in UI | Provider | Eval model id | Why it’s on the list |
|---|---|---|---|---|
| `haiku-4.5` | Claude Haiku 4.5 | Anthropic | `claude-haiku-4-5-20251001` | Fair “fast current classifier” |
| `gpt-luna` | GPT 5.6 Luna | OpenAI | `gpt-5.6-luna` | AI SDK’s documented OpenAI eval example |
| `gemini-flash-lite` | Gemini 3.5 Flash Lite | Google | `gemini-3.5-flash-lite` | Cheap / fast Google baseline |
| `sonnet` | Claude Sonnet (no extra reasoning) | Anthropic | pin current Sonnet id at build time | Shows “smarter, still late” |

Verify each id against the provider’s current catalog at build time. The AI SDK evaluation page treats those ids as **API-compatible examples, not benchmarks**. If an id 404s, swap it; do not invent aliases.

**Do not put** a heavy reasoning model on the default list. A 20-second thinking call wrecks the 12s run and looks like we sandbagged. If we add one later, force `reasoning: none` / `reasoningEffort: none` (AI SDK eval adapters already request `reasoning: 'none'` by default).

### 3.3 Key ping (before Start)

`POST /api/ping`

- Jev: `GET https://api.typesafe.ai/v1/models` with the user key. 401 → “TypeSafe key rejected.”
- Opponent: smallest eval or models-list call. 401 → “Opponent key rejected.”

Do not start the 12s run on a bad key. That wastes money and kills the recording.

---

## 4. Visual / UX

**Design read:** a live instrument for engineers watching a LinkedIn clip, not a SaaS landing page. Language = two lane race telemetry. One signature: two vehicles meeting the same hazard on one shared distance axis. The gap between them *is* the product.

**Avoid:** purple AI gradients, glassmorphism, Inter-on-slate, three feature cards, a winner trophy, “only Jev can play.”

### 4.1 Layout (desktop first; LinkedIn is recorded at 1920×1080)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ JEV REFLEX            00:12  ● LIVE              opponent: Haiku 4.5      │
├──────────────────┬────────────────────────────────────────────┬───────────┤
│ JEV       94ms   │ ══════════════════════[car]  (pothole) (cow)│  1,400 m │
│ clean 14  hit 2  │                                             │           │
├──────────────────┼────────────────────────────────────────────┼───────────┤
│ HAIKU 4.5  1.4s  │ ═══════[auto] X      (pothole)      (cow)   │    620 m │
│ clean 4   hit 8  │                                             │           │
├──────────────────┴────────────────────────────────────────────┴───────────┤
│  Jev leads by 780 m.                                                      │
└───────────────────────────────────────────────────────────────────────────┘
```

- Top lane accent: cool phosphor (one teal, not neon rainbow).
- Bottom lane accent: warm amber.
- Both roads share one metres-to-pixels scale, owned by `RaceStage`, so the horizontal gap is the real gap.
- Vehicle x is cumulative distance. It tweens on each resolved beat, never on a rAF loop.
- Hazard closes on the vehicle over one beat. Clean dodge swerves, a clip or a hit shakes.
- Big latency number updates on every response. This is what people screenshot.

### 4.2 Motion

Use **GSAP + `@gsap/react` `useGSAP`** for the vehicle and hazard timing. Keep Motion/Framer off the critical path so one library owns the signature animation.

- Vehicle advance: 350ms ease out, triggered by a resolved beat.
- Swerve: 90ms up and back on a clean dodge.
- Hazard approach: one beat, `ease: "none"`, so closing speed reads as the deadline.
- The opponent still braking while Jev is two hazards ahead is the joke. Do not add extra sparkles.
- `prefers-reduced-motion`: nothing travels or shakes; vehicles jump to their distance and the numbers still update.

### 4.3 Copy

- Title: **Jev Reflex**
- Subtitle: **Same road. Same hazard. Different clocks.**
- Jev lane caption: `decision model · no text out`
- Disabled “Explain” chip on Jev: `Jev can’t write why`
- Start button: `Run 12 seconds`
- Recap has no “Winner.” Headline is the two-line stats block.

### 4.4 Type / color (lock before build)

| Token | Value | Use |
|---|---|---|
| `bg` | `#0E1114` | page |
| `panel` | `#161B20` | lanes |
| `ink` | `#E7E1D4` | primary text |
| `jev` | `#3EE0C4` | left lane |
| `opp` | `#E2A34A` | right lane |
| `miss` | `#E35D5D` | wrong tick |

Display: **IBM Plex Mono** (timers, ms, scores). Body: **Newsreader** or **Fraunces** at small sizes for titles only. Utility: Plex Sans if needed. Do not use Inter / Geist / default system UI font as the personality.

---

## 5. Architecture

### 5.1 Stack

| Piece | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript | one repo, API routes, easy Vercel deploy |
| Jev | `@typesafe-ai/sdk` `TypeSafeClient.systemOne` | official JS SDK, retries, types |
| Opponent | Vercel AI SDK `experimental_evaluate` + provider `evaluationModel()` | **same question schema** as Jev; this is TypeSafe’s own fair wrapper for LLMs |
| Motion | `gsap` + `@gsap/react` | signature pulse |
| Style | CSS modules or vanilla CSS, no component-kit look | keep it an instrument |

Node 20+. Jev SDK requires it.

**Do not** call TypeSafe from the browser (`dangerouslyAllowBrowser` exists and is the wrong idea). Keys would leak in the JS bundle / network panel of every LinkedIn viewer if we ever host this public.

### 5.2 Request flow

```
Browser                    Next.js                     Providers
───────                    ───────                     ─────────
POST /api/run  ────────►  validate keys
  { keys, modelId,         pick 17 events
    durationMs, seed }     start clock

                           for each beat:
                             Promise.allSettled([
                               jev.systemOne(state, Q),
                               evaluate(opp, state, Q)
                             ])
                             SSE event per resolution

◄──── SSE: trial, trial, … recap

Browser never talks to api.typesafe.ai or OpenAI/Anthropic directly.
```

SSE (or a single ReadableStream) is required so Jev’s stamp can appear at 90ms while Haiku is still pending. A single JSON-at-the-end response would hide the whole point.

### 5.3 Server modules (target files)

```
jev-reflex/
  plan.md                          ← this file
  src/data/events.json             ← 40 labeled hazards
  src/lib/models.ts                ← curated opponent list + pricing
  src/lib/scoring.ts               ← pure functions, unit-tested
  src/lib/race.ts                  ← outcome + distance model, unit-tested
  src/lib/track.ts                 ← beat-window position maths, unit-tested
  src/lib/hazards.ts               ← hazard id → Phosphor glyph
  src/lib/jev.ts                   ← TypeSafeClient wrapper
  src/lib/opponent.ts              ← experimental_evaluate wrapper
  src/app/api/ping/route.ts
  src/app/api/run/route.ts         ← SSE
  src/app/page.tsx                 ← setup + race + recap
  src/components/Road.tsx          ← one lane: cluster, road, odometer
  src/components/RaceStage.tsx     ← both lanes, shared distance scale
  src/components/Setup.tsx
  src/components/Recap.tsx
```

### 5.4 Allowed APIs (copy these; do not invent)

**Jev HTTP**

```
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <TYPESAFE_API_KEY>
Content-Type: application/json
```

Body: `{ model, state, questions }`. Default model: `"jev-latest"`.

**Jev JS SDK** ([docs](https://docs.typesafe.ai/sdk/javascript.md))

```ts
import { choice, TypeSafeClient } from "@typesafe-ai/sdk";

const client = new TypeSafeClient({ apiKey }); // do not use env on a multi-tenant route
const { answers, model, usage } = await client.systemOne({
  model: "jev-latest",
  state,
  questions: {
    call: choice(
      "You are driving. What should the driver do for this hazard? Use `cue` and `notes`. If the painted markings disagree with the open side, or the hazard is not real, hold the line.",
      {
        left: "Swerve left. The hazard is real and the left side of the road is open.",
        right: "Swerve right. The hazard is real and the right side of the road is open.",
        hold: "Hold the line. Do not swerve. The markings disagree with the open side, neither side is open, or the hazard is not real.",
      },
    ),
  },
});
const picked = answers.call.choice; // "left" | "right" | "hold"
const confidence = answers.call.confidence;
```

`TypeSafeClient` config: `apiKey`, `timeout` (default 10000ms), `retry`. Per-call `RequestOptions` for abort.

**Jev errors to handle:** `401` bad key, `422` bad body, `429` rate limit, `529` overloaded. SDK retries 429/529. For a 12s demo, cap retries (1–2) so a stuck 529 does not freeze the lane.

**Jev limits (jev-1.13.0):** 64k tokens/request; 32k for state + longest question; **1,200 RPM** and **250k tokens/sec** (dynamic while they scale). Our 17 calls in 12s is trivial.

**Opponent — AI SDK evaluation** ([docs](https://ai-sdk.dev/docs/ai-sdk-core/evaluation))

```ts
import { experimental_evaluate } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const result = await experimental_evaluate({
  model: anthropic.evaluationModel("claude-haiku-4-5-20251001"),
  state,
  questions: {
    call: {
      type: "choice",
      instructions: "...same string as Jev...",
      criteria: { left: "...", right: "...", hold: "..." },
    },
  },
});
const picked = result.answers.call.choice;
// result.answers.call.probabilities is OPTIONAL for LLM adapters
```

Important adapter facts (from that doc, do not ignore):

- TypeSafe is native Choice/Score/Boolean.
- OpenAI / Anthropic / Google **adapt structured LLM output**. Choice/Score **may omit probability distributions**. Do not fake them in the UI.
- Boolean field is `probability`, not TypeSafe’s `noul`. We are using Choice only, so this does not matter unless we add a Noul later.
- Adapters evaluate all questions in **one prompt**, not Jev’s parallel independent questions. With one Choice per call, this is fine.
- LLM probability estimates are **not calibrated**.

**Latency:** `const t0 = performance.now()` immediately before the provider call, `t1` after it resolves, on the **server**. That is the number on the lane. Also send `beat_id` and `t_beat` so the client can mark LATE against the beat clock.

### 5.5 Fairness rules (non-negotiable)

1. Identical `state` and identical `questions` for both models.
2. Fire both at the same beat timestamp.
3. Do not give the LLM a longer prompt, chain of thought, or extra tools.
4. Do not give Jev a shorter state.
5. Gold labels are authored, not model-generated.
6. Timeouts count against accuracy.
7. If Jev errors, show error on the left — do not silently skip.

### 5.6 Cost cap

- Max **20** events per run.
- Abort a model’s remaining calls if it has `timeout + error >= 5`.
- Recap still renders with whatever landed.
- Rough cost at 17 events, ~400 input tokens: Jev ≈ **$0.0003**. A mini/Haiku-class model is cents, not dollars. Still show `$` because LinkedIn loves it.

Pricing table in `src/lib/models.ts` (update if providers move):

- Jev: `$0.042 / 1M input`, `$0` output.
- Opponent: copy public input+output rates next to each list entry.

---

## 6. Security

- Keys only in `POST` JSON to our API. Never cookies, never URL.
- Server constructs `TypeSafeClient({ apiKey })` and provider clients per request. No global client with a process env key for user-supplied keys.
- Do not log bodies at `debug` on TypeSafe SDK in production (`logLevel: "warn"`). SDK debug logs **bodies** (credentials in headers are redacted; bodies are not).
- Rate-limit `/api/run` per IP (e.g. 10 runs / 10 min) so a pasted key cannot be used as an open proxy.
- CORS: same-origin only.
- If we deploy publicly: add a one-line warning: “Keys are sent to this demo’s server for the run, then discarded.”
- `.gitignore` `.env*`. Never commit keys.
- For the LinkedIn recording, the author can use env keys locally so they don’t type secrets on camera. Support `TYPESAFE_API_KEY` + opponent env as a **dev-only** prefill, behind `NODE_ENV === "development"`.

---

## 7. Implementation phases (when we build)

Each phase is a new chat. Read this file + the cited docs first. Do not invent APIs.

### Phase 0 — already done (documentation)

Sources used:

- https://docs.typesafe.ai/introduction.md
- https://docs.typesafe.ai/introduction/quickstart.md
- https://docs.typesafe.ai/api.md
- https://docs.typesafe.ai/models.md
- https://docs.typesafe.ai/model-jaggedness/jev-1.13.md
- https://docs.typesafe.ai/sdk/javascript.md
- https://docs.typesafe.ai/sdk/javascript/api/classes/TypeSafeClient.md
- https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md
- https://ai-sdk.dev/docs/ai-sdk-core/evaluation
- https://typesafe.ai/blog/introducing-system-one-models-and-jev
- https://vercel.com/docs/ai-gateway/modalities/evaluation

### Phase 1 — skeleton + scoring (no providers)

- Next.js app, tokens, empty dual-lane layout, 12s fake clock.
- `events.json` (40 items).
- `scoring.ts` with unit tests: late vs on-time, timeout = miss, p50.

**Verify:** `pnpm test` on scoring. Fake run with mocked 90ms vs 1400ms stamps looks right.

**Anti-pattern:** do not call any model yet.

### Phase 2 — Jev lane live

- `/api/ping` + `/api/run` SSE with **Jev only**.
- User pastes TypeSafe key.
- Left stamps are real; right lane shows `idle`.

**Verify:** 12s run, ~17 SSE events, p50 in the 70–500ms band from India may be higher (TypeSafe is US West). Measure; don’t hardcode 100ms in the UI as a promise.

**Anti-pattern:** `dangerouslyAllowBrowser`. Do not use `noul` for a 3-way call. Do not ask Jev to generate an explanation.

### Phase 3 — opponent lane

- Wire `experimental_evaluate` for Haiku first, then the rest of the list.
- Same questions object. Parallel fire. Right stamps arrive late.

**Verify:** one run against Haiku. Recap shows higher latency, on-time % lower. If Haiku accuracy is higher, keep it.

**Anti-pattern:** `generateText` + regex JSON parse. Use the eval API. Do not display fake `probabilities` when the adapter omits them. Do not enable reasoning.

### Phase 4 — recap + record mode

- Recap stats, copy-to-clipboard block, seed replay.
- Hide key inputs during the run (clean 20s screen recording).
- Optional Slow/Burst only if Default already looks good.

**Verify:** record 20s at 1080p. A stranger understands “left is fast, right is late, numbers are accuracy” without reading a caption.

### Phase 5 — polish + deploy

- Reduced motion, mobile “record on desktop” notice, error states (401, 429, 529).
- Deploy if wanted. Confirm keys are not in client bundles (`next build` + grep).

---

## 8. LinkedIn use (after it works)

Record **Default tempo** only.

Script:

1. Keys already in (dev prefill) so the clip starts on the scopes.
2. 2s of both lanes idle, then Start.
3. Let 12s play. Do not talk over the first 5s.
4. Hold recap 4s.

Caption draft:

> I built a 12-second reaction test for model speed.  
> Same state. Same 3-way choice. Jev on the left, [model] on the right.  
> Jev is not an LLM. It doesn’t write. It decides.  
> At this tempo the bigger model is often still right — just not on time.

Do not use TypeSafe’s Doom / Wikiracing framing. Do not clone the ping-pong “three models vote each rally” demo.

---

## 9. Out of scope (v1)

- Human-player click mode (the original reflex idea). Add later if we want a 4th lane.
- Streaming tokens (Jev has nothing to stream).
- Multi-question fan-out in one call (great Jev story, different demo).
- OpenRouter / one-key Gateway as the only auth path.
- Leaderboards, accounts, storing runs.
- Fine-tuning, images, audio.
- Claiming Jev wins intelligence.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| From India, Jev RTT is 200–400ms not 100ms | Measure server-side; still likely 5–10× vs LLM. Do not print TypeSafe’s West Coast 100ms as our number. |
| Early-access 429 / 529 | Short retries; show `overloaded` on the lane; recap with partial n. |
| LLM eval API still experimental | Pin `ai` version. If it breaks, fall back to provider structured output with the **same** 3-key schema — last resort only. |
| Jev accuracy tanking on cute hazards | Follow jaggedness doc: literal instructions, no indirection, no counting. Rewrite hazards, don’t “prompt harder.” |
| Opponent looks stupid because we used a reasoning model | Default list is Haiku / Luna / Flash-Lite. |
| People say the task is a toy | Recap sentence: this is a stand-in for any tight-loop judgment (moderation, routing, tool-gate). |
| Key leak | Server-only calls, no storage, IP rate limit. |

---

## 11. Success criteria

A run is done when all of these are true:

1. User can paste keys, pick one opponent, press Start.
2. For 12 seconds, both lanes receive the same events.
3. Jev stamps appear near-immediately; opponent stamps lag.
4. Recap shows latency, accuracy, on-time, cost for both.
5. If the opponent is more accurate, the UI says so.
6. Nothing on screen claims Jev can write, reason, or “do everything.”
7. A 20-second screen recording is enough for a LinkedIn post.

---

## 12. Open items (do not block v1)

- Confirm current Anthropic/OpenAI/Google eval model ids the week we build (catalog moves).
- Whether Vercel Gateway one-key path is worth a second auth tab.
- Whether to add Slow tempo as a second clip (accuracy-first) after the speed clip performs.

---

## 13. Doc cheat sheet for the implementing agent

| Need | Open this |
|---|---|
| Request/response shape | https://docs.typesafe.ai/api.md |
| JS client | https://docs.typesafe.ai/sdk/javascript.md |
| `apiKey` / no-browser | https://docs.typesafe.ai/sdk/javascript/api/interfaces/TypeSafeClientConfig.md |
| Model ids, RPM, price | https://docs.typesafe.ai/models.md |
| What Jev is bad at | https://docs.typesafe.ai/model-jaggedness/jev-1.13.md |
| Fair LLM wrapper | https://ai-sdk.dev/docs/ai-sdk-core/evaluation |
| Choice vs Noul vs Score | https://docs.typesafe.ai/primitives.md |
