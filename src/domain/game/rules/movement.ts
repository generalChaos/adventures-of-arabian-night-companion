import type { BoardEdge, BoardLocation } from "../types/game";
import type { LocationId } from "../types/ids";

export type MovementAllowance = {
  landMovement: number;
  seaMovement: number;
};

/** MVP 1: adjacent spaces only (any connection type). */
export function getAdjacentLocationIds(
  locationId: LocationId,
  edges: BoardEdge[],
): LocationId[] {
  const ids = new Set<LocationId>();
  for (const edge of edges) {
    if (edge.fromLocationId === locationId) ids.add(edge.toLocationId);
    if (edge.toLocationId === locationId) ids.add(edge.fromLocationId);
  }
  return [...ids];
}

export function isAdjacentMove(
  from: LocationId,
  to: LocationId,
  edges: BoardEdge[],
): boolean {
  return getAdjacentLocationIds(from, edges).includes(to);
}

export function findLocation(
  locations: BoardLocation[],
  id: LocationId,
): BoardLocation | undefined {
  return locations.find((l) => l.id === id);
}

type PathCost = { land: number; sea: number };

/**
 * Locations reachable within land/sea budgets.
 * SEA edges require both endpoints to be ports.
 * Off-rule moves remain allowed at the command layer; this is for highlighting.
 */
export function getReachableLocationIds(
  from: LocationId,
  edges: BoardEdge[],
  locations: BoardLocation[],
  allowance: MovementAllowance,
): LocationId[] {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const best = new Map<string, PathCost>();
  const queue: { id: LocationId; land: number; sea: number }[] = [
    { id: from, land: 0, sea: 0 },
  ];
  best.set(from, { land: 0, sea: 0 });

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const edge of edges) {
      let nextId: LocationId | null = null;
      if (edge.fromLocationId === cur.id) nextId = edge.toLocationId;
      else if (edge.toLocationId === cur.id) nextId = edge.fromLocationId;
      if (!nextId) continue;

      const fromLoc = byId.get(cur.id);
      const toLoc = byId.get(nextId);
      if (!fromLoc || !toLoc) continue;

      let land = cur.land;
      let sea = cur.sea;
      if (edge.connectionType === "LAND") {
        land += 1;
      } else {
        if (!fromLoc.isPort || !toLoc.isPort) continue;
        sea += 1;
      }

      if (land > allowance.landMovement || sea > allowance.seaMovement) continue;

      const prev = best.get(nextId);
      // Skip if we already reached with a weakly better (or equal) cost pair
      if (prev && prev.land <= land && prev.sea <= sea) continue;
      best.set(nextId, { land, sea });
      queue.push({ id: nextId, land, sea });
    }
  }

  const result: LocationId[] = [];
  for (const id of best.keys()) {
    if (id !== from) result.push(id);
  }
  return result;
}

export function isWithinMovementAllowance(
  from: LocationId,
  to: LocationId,
  edges: BoardEdge[],
  locations: BoardLocation[],
  allowance: MovementAllowance,
): boolean {
  return getReachableLocationIds(from, edges, locations, allowance).includes(to);
}
