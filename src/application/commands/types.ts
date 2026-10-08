import type { Db } from "@/infrastructure/database/drizzle";
import type { GameSnapshot } from "@/domain/game/types/game";
import type { UserId } from "@/domain/game/types/ids";

export type CommandContext = {
  db: Db;
  userId: UserId;
};

export type CommandResult = {
  snapshot: GameSnapshot;
};
