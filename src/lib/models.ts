export type OpponentProvider = "anthropic" | "openai" | "google";

export type Opponent = {
  id: string;
  label: string;
  provider: OpponentProvider;
  evalModelId: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export const JEV_PRICING = {
  label: "Jev",
  model: "jev-latest",
  inputUsdPerMillion: 0.042,
  outputUsdPerMillion: 0,
} as const;

export const OPPONENTS: Opponent[] = [
  {
    id: "haiku-4.5",
    label: "Claude Haiku 4.5",
    provider: "anthropic",
    evalModelId: "claude-haiku-4-5-20251001",
    inputUsdPerMillion: 1,
    outputUsdPerMillion: 5,
  },
  {
    id: "gpt-luna",
    label: "GPT 5.6 Luna",
    provider: "openai",
    evalModelId: "gpt-5.6-luna",
    inputUsdPerMillion: 0.2,
    outputUsdPerMillion: 1.2,
  },
  {
    id: "gemini-flash-lite",
    label: "Gemini 3.5 Flash Lite",
    provider: "google",
    evalModelId: "gemini-3.5-flash-lite",
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
  },
  {
    id: "sonnet",
    label: "Claude Sonnet 5",
    provider: "anthropic",
    evalModelId: "claude-sonnet-5",
    inputUsdPerMillion: 2,
    outputUsdPerMillion: 10,
  },
];

export function getOpponent(id: string): Opponent | undefined {
  return OPPONENTS.find((item) => item.id === id);
}

export function estimateUsd(
  inputTokens: number,
  outputTokens: number,
  inputUsdPerMillion: number,
  outputUsdPerMillion: number,
): number {
  return (
    (inputTokens / 1_000_000) * inputUsdPerMillion +
    (outputTokens / 1_000_000) * outputUsdPerMillion
  );
}

export function opponentEnvName(provider: OpponentProvider): string {
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  if (provider === "openai") return "OPENAI_API_KEY";
  return "GOOGLE_GENERATIVE_AI_API_KEY";
}
