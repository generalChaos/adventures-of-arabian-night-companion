import { notFound } from "next/navigation";
import { getDb } from "@/infrastructure/database/drizzle";
import { ensureAuthenticatedUser } from "@/application/services/auth";
import { loadGameSnapshot } from "@/application/queries/load-game-snapshot";
import { GameScreen } from "@/components/game/GameScreen";
import { UnauthorizedGame } from "@/components/game/UnauthorizedGame";
import { DomainError } from "@/domain/game/types/errors";
import type { GameSnapshot } from "@/domain/game/types/game";

type Props = {
  params: Promise<{ gameId: string }>;
};

async function loadPageData(gameId: string): Promise<
  | { kind: "ok"; snapshot: GameSnapshot }
  | { kind: "forbidden" }
  | { kind: "not_found" }
> {
  try {
    const user = await ensureAuthenticatedUser();
    const snapshot = await loadGameSnapshot(getDb(), gameId, user.id);
    if (!snapshot.me && snapshot.game.status !== "LOBBY") {
      return { kind: "forbidden" };
    }
    return { kind: "ok", snapshot };
  } catch (error) {
    if (error instanceof DomainError && error.code === "NOT_FOUND") {
      return { kind: "not_found" };
    }
    throw error;
  }
}

export default async function GamePage({ params }: Props) {
  const { gameId } = await params;
  const result = await loadPageData(gameId);

  if (result.kind === "not_found") notFound();

  if (result.kind === "forbidden") {
    return <UnauthorizedGame />;
  }

  return <GameScreen key={result.snapshot.game.id} initial={result.snapshot} />;
}
