import type { GameCommand } from "@/domain/game/types/commands";

export type CommandLogFields = {
  requestId: string;
  gameId?: string;
  actorId: string;
  actionType: string;
  expectedVersion?: number;
  durationMs: number;
  success: boolean;
  errorCode?: string;
};

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function gameIdFromCommand(command: GameCommand): string | undefined {
  if ("gameId" in command) return command.gameId;
  return undefined;
}

export function expectedVersionFromCommand(
  command: GameCommand,
): number | undefined {
  if ("expectedVersion" in command) return command.expectedVersion;
  return undefined;
}

export function logCommand(fields: CommandLogFields): void {
  console.info(
    JSON.stringify({
      kind: "game_command",
      ...fields,
      at: new Date().toISOString(),
    }),
  );
}
