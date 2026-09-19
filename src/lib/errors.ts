export function providerMessage(err: unknown, lane: "jev" | "opp"): string {
  const record = err as {
    status?: number;
    statusCode?: number;
    name?: string;
    message?: string;
  };
  const status = record.status ?? record.statusCode;
  if (status === 401 || status === 403) {
    return lane === "jev"
      ? "TypeSafe key rejected."
      : "Opponent key rejected.";
  }
  if (status === 422) return "Bad request.";
  if (status === 429) return "Rate limited.";
  if (status === 529) return "Overloaded.";
  if (record.name === "AbortError" || record.name === "APIUserAbortError") {
    return "timeout";
  }
  if (typeof record.message === "string" && record.message.length > 0) {
    return record.message.slice(0, 80);
  }
  return "Call failed.";
}

export function isAbortError(err: unknown): boolean {
  const record = err as { name?: string };
  return (
    record.name === "AbortError" ||
    record.name === "APIUserAbortError" ||
    (err instanceof Error && err.name === "AbortError")
  );
}
