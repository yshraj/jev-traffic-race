import { App } from "@/components/App";
import { OPPONENTS } from "@/lib/models";

export default function Page() {
  const prefill =
    process.env.NODE_ENV === "development"
      ? {
          typesafeKey: process.env.TYPESAFE_API_KEY ?? "",
          opponentKeys: {
            anthropic: process.env.ANTHROPIC_API_KEY ?? "",
            openai: process.env.OPENAI_API_KEY ?? "",
            google:
              process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
              process.env.GEMINI_API_KEY ??
              "",
          },
        }
      : null;

  return <App opponents={OPPONENTS} prefill={prefill} />;
}
