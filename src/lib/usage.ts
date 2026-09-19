import type { Usage } from "@/lib/types";

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function readUsage(usage: unknown): Usage {
  if (!usage || typeof usage !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const record = usage as Record<string, unknown>;
  return {
    inputTokens: asNumber(
      record.inputTokens ?? record.input_tokens ?? record.promptTokens,
    ),
    outputTokens: asNumber(
      record.outputTokens ?? record.output_tokens ?? record.completionTokens,
    ),
  };
}
