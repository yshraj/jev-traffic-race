# Jev Reflex

Two-lane traffic race demo: [Jev](https://typesafe.ai) vs any frontier LLM classifying Bombay road hazards at loop speed. Same question, same state, different clocks.

At slow tempo, the opponent may win on accuracy. At peak or monsoon traffic, Jev is the one still answering on time.

## What this shows

| Axis | How it appears |
| --- | --- |
| **Speed** | p50 / p95 latency, answers/sec, on-time % |
| **Accuracy** | correct vs gold label |
| **Cost** | tokens + estimated USD for the run |
| **Honesty** | the opponent may beat Jev on accuracy at Rush hour; Jev wins on-time at loop speed |

### What we do not claim

- Jev is smarter than Claude, GPT, or Gemini
- Jev replaces general-purpose LLMs
- Jev can explain its reasoning (it is a System One model — structured answers only)
- This is a formal benchmark

The race visuals are a **display convention**. Metres earned per hazard are derived from timing and correctness so the gap between lanes is easy to read. Latency, accuracy, and cost numbers come straight from the providers.

## Quick start

**Requirements:** Node.js 20+, pnpm

```bash
git clone https://github.com/<you>/jev-reflex.git
cd jev-reflex
pnpm install
cp .env.example .env
```

Add your API keys to `.env` (dev only — keys are prefilled in the setup form when `NODE_ENV=development`):

| Variable | Used for |
| --- | --- |
| `TYPESAFE_API_KEY` | Jev ([TypeSafe](https://typesafe.ai)) |
| `ANTHROPIC_API_KEY` | Claude opponents |
| `OPENAI_API_KEY` | GPT opponents |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini opponents |

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Paste your **Jev API key** and pick an **opponent** (Claude Haiku 4.5, GPT 5.6 Luna, Gemini 3.5 Flash Lite, or Claude Sonnet 5).
2. Paste the **opponent API key** for that provider.
3. Choose **traffic** tempo and run **duration** (10s, 12s, or 15s).
4. Click **Drive** — hazards stream in; Jev drives the top lane, the opponent the bottom.
5. At the end, read the recap: latency, on-time %, accuracy, cost, and road distance. Copy stats for a post or start a new road with a fresh seed.

Keys are sent to this app's server for the run and then discarded. Do not deploy this demo publicly without understanding that tradeoff.

## Traffic tempo

| Preset | Beat | What to expect |
| --- | --- | --- |
| **Rush hour** | 1200 ms | Both models mostly keep up. Accuracy is the story. |
| **Peak traffic** | 700 ms | Jev stays on beat; the opponent starts slipping. |
| **Monsoon** | 400 ms | The opponent backlog is hard to miss. |

Beats keep firing even if the opponent is still thinking. Late answers count as clipped; timeouts and errors stall the lane.

## Race readout

Each hazard maps to an outcome for that driver:

| Outcome | When | Metres (display) |
| --- | --- | --- |
| Clean | Correct, on time | 100 m |
| Clipped | Correct, late | 45 m |
| Hit | Wrong label | 20 m |
| Stalled | Timeout or error | 0 m |

Lane position is relative distance on a shared axis — the gap between vehicles is the performance difference, not a separate score.

## Opponents

Configured in `src/lib/models.ts`:

- Claude Haiku 4.5
- GPT 5.6 Luna
- Gemini 3.5 Flash Lite
- Claude Sonnet 5

Jev uses model `jev-latest` via `@typesafe-ai/sdk`. The opponent uses the Vercel AI SDK `experimental_evaluate` with the same choice question and identical JSON state.

## Development

```bash
pnpm dev      # Next.js dev server (Turbopack)
pnpm build    # Production build
pnpm start    # Serve production build
pnpm test     # Vitest unit tests
pnpm lint     # ESLint
```

### Project layout

```
src/
  app/              Next.js App Router (page, API routes)
  components/       App, Setup, RaceStage, Road, Recap
  data/events.json  40 Bombay road hazards (gold labels held server-side)
  lib/
    race.ts         Outcome → metres mapping (presentation only)
    scoring.ts      Latency, accuracy, cost aggregation
    jev.ts          TypeSafe SDK client
    opponent.ts     AI SDK evaluate wrapper
    hazards.ts      Hazard glyphs (Phosphor icons)
```

### API routes

| Route | Purpose |
| --- | --- |
| `POST /api/ping` | Validate keys before a run |
| `POST /api/run` | SSE stream of trial results for one simulation |

`POST /api/run` accepts `typesafeKey`, `opponentKey`, `modelId`, `durationMs`, `beatMs`, and optional `seed`. Rate limiting is applied per IP in memory.

## Deploy

Works on any Node 20+ host (e.g. Vercel). Set `maxDuration` is already 30s on the run route for longer simulations.

For a public demo, consider:

- Proxying provider calls through your own backend with server-side keys
- Tighter rate limits or auth
- Not asking visitors to paste production keys

## Event data

`src/data/events.json` holds 40 hazards with a fixed mix: 20 clear, 10 conflict (markings disagree with the open side), 6 fake, 4 edge. Models receive `cue` and `notes` as JSON state; gold labels never leave the server.

Choices are always `left`, `right`, or `hold` (swerve left, swerve right, or hold the line).

## License

Add a license file before publishing if you plan to open-source the repo.
