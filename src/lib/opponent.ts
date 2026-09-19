import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { experimental_evaluate } from "ai";
import { getOpponent, type Opponent } from "@/lib/models";
import { EVAL_QUESTIONS, type ModelState } from "@/lib/questions";
import { isLabel } from "@/lib/scoring";
import { readUsage } from "@/lib/usage";
import type { CallResult } from "@/lib/jev";

function evaluationModel(opponent: Opponent, apiKey: string) {
  if (opponent.provider === "anthropic") {
    return createAnthropic({ apiKey }).evaluationModel(opponent.evalModelId);
  }
  if (opponent.provider === "openai") {
    return createOpenAI({ apiKey }).evaluationModel(opponent.evalModelId);
  }
  return createGoogleGenerativeAI({ apiKey }).evaluationModel(
    opponent.evalModelId,
  );
}

export async function callOpponent(
  opponent: Opponent,
  apiKey: string,
  state: ModelState,
  signal?: AbortSignal,
): Promise<CallResult> {
  const t0 = performance.now();
  const result = await experimental_evaluate({
    model: evaluationModel(opponent, apiKey),
    state,
    questions: EVAL_QUESTIONS,
    abortSignal: signal,
    maxRetries: 1,
  });
  const latencyMs = performance.now() - t0;
  const picked = result.answers.call.choice;
  if (!isLabel(picked)) {
    throw new Error("Opponent returned an unknown choice.");
  }
  return {
    choice: picked,
    latencyMs,
    usage: readUsage(result.usage),
  };
}

export async function pingOpponent(
  opponent: Opponent,
  apiKey: string,
): Promise<void> {
  if (opponent.provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      cache: "no-store",
    });
    rejectIfBad(response, "Opponent key rejected.");
    return;
  }

  if (opponent.provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    rejectIfBad(response, "Opponent key rejected.");
    return;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" },
  );
  rejectIfBad(response, "Opponent key rejected.");
}

function rejectIfBad(response: Response, message: string): void {
  if (response.status === 401 || response.status === 403) {
    const error = new Error(message);
    (error as { status?: number }).status = 401;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`Opponent ping failed (${response.status}).`);
  }
}

export function requireOpponent(id: string): Opponent {
  const opponent = getOpponent(id);
  if (!opponent) {
    throw new Error("Unknown opponent.");
  }
  return opponent;
}
