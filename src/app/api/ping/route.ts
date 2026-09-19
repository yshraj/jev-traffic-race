import { pingJev } from "@/lib/jev";
import { pingOpponent, requireOpponent } from "@/lib/opponent";
import { providerMessage } from "@/lib/errors";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PingBody = {
  typesafeKey?: string;
  opponentKey?: string;
  modelId?: string;
};

export async function POST(request: Request) {
  let body: PingBody;
  try {
    body = (await request.json()) as PingBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const typesafeKey = body.typesafeKey?.trim() ?? "";
  const opponentKey = body.opponentKey?.trim() ?? "";
  const modelId = body.modelId?.trim() ?? "";

  if (!typesafeKey || !opponentKey || !modelId) {
    return NextResponse.json(
      { ok: false, error: "Both keys and an opponent are required." },
      { status: 400 },
    );
  }

  let opponent;
  try {
    opponent = requireOpponent(modelId);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unknown opponent." },
      { status: 400 },
    );
  }

  const errors: { jev?: string; opponent?: string } = {};

  const [jevResult, oppResult] = await Promise.allSettled([
    pingJev(typesafeKey),
    pingOpponent(opponent, opponentKey),
  ]);

  if (jevResult.status === "rejected") {
    errors.jev = providerMessage(jevResult.reason, "jev");
  }
  if (oppResult.status === "rejected") {
    errors.opponent = providerMessage(oppResult.reason, "opp");
  }

  if (errors.jev || errors.opponent) {
    return NextResponse.json({ ok: false, ...errors }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
