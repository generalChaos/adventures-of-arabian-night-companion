import { NextResponse } from "next/server";
import { getDb } from "@/infrastructure/database/drizzle";
import { ensureAuthenticatedUser } from "@/application/services/auth";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { DomainError } from "@/domain/game/types/errors";

type Params = { params: Promise<{ gameId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { gameId } = await params;
    const user = await ensureAuthenticatedUser();
    const snapshot = await loadGameSnapshot(getDb(), gameId, user.id);
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error(error);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
