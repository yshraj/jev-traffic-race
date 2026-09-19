import { choice, TypeSafeClient } from "@typesafe-ai/sdk";
import { CALL_CRITERIA, CALL_INSTRUCTIONS, type ModelState } from "@/lib/questions";
import { isLabel } from "@/lib/scoring";
import { readUsage } from "@/lib/usage";
import type { Label, Usage } from "@/lib/types";

export function createJevClient(apiKey: string): TypeSafeClient {
  return new TypeSafeClient({
    apiKey,
    logLevel: "warn",
    timeout: 8000,
    retry: {
      maxRetries: 1,
      backoffMaxMs: 800,
    },
  });
}

export type CallResult = {
  choice: Label;
  confidence?: number;
  latencyMs: number;
  usage: Usage;
};

export async function callJev(
  client: TypeSafeClient,
  state: ModelState,
  signal?: AbortSignal,
): Promise<CallResult> {
  const t0 = performance.now();
  const { answers, usage } = await client.systemOne(
    {
      model: "jev-latest",
      state,
      questions: {
        call: choice(CALL_INSTRUCTIONS, CALL_CRITERIA),
      },
    },
    { signal },
  );
  const latencyMs = performance.now() - t0;
  const picked = answers.call.choice;
  if (!isLabel(picked)) {
    throw new Error("Jev returned an unknown choice.");
  }
  return {
    choice: picked,
    confidence: answers.call.confidence,
    latencyMs,
    usage: readUsage(usage),
  };
}

export async function pingJev(apiKey: string): Promise<void> {
  const response = await fetch("https://api.typesafe.ai/v1/models", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) {
    const error = new Error("TypeSafe key rejected.");
    (error as { status?: number }).status = 401;
    throw error;
  }
  if (!response.ok) {
    throw new Error(`TypeSafe ping failed (${response.status}).`);
  }
}
