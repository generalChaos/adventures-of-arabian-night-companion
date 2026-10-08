import { describe, expect, it } from "vitest";
import {
  getAdjacentLocationIds,
  getReachableLocationIds,
  isAdjacentMove,
  isWithinMovementAllowance,
} from "@/domain/game/rules/movement";
import type { BoardEdge, BoardLocation } from "@/domain/game/types/game";

const edges: BoardEdge[] = [
  {
    id: "1",
    fromLocationId: "baghdad",
    toLocationId: "damascus",
    connectionType: "LAND",
  },
  {
    id: "2",
    fromLocationId: "baghdad",
    toLocationId: "basra",
    connectionType: "LAND",
  },
  {
    id: "3",
    fromLocationId: "basra",
    toLocationId: "alexandria",
    connectionType: "SEA",
  },
];

const locations: BoardLocation[] = [
  {
    id: "baghdad",
    slug: "baghdad",
    name: "Baghdad",
    spaceType: "CITY",
    isPort: false,
    x: 0,
    y: 0,
  },
  {
    id: "damascus",
    slug: "damascus",
    name: "Damascus",
    spaceType: "CITY",
    isPort: false,
    x: 0,
    y: 0,
  },
  {
    id: "basra",
    slug: "basra",
    name: "Basra",
    spaceType: "CITY",
    isPort: true,
    x: 0,
    y: 0,
  },
  {
    id: "alexandria",
    slug: "alexandria",
    name: "Alexandria",
    spaceType: "CITY",
    isPort: true,
    x: 0,
    y: 0,
  },
];

describe("movement", () => {
  it("lists adjacent locations", () => {
    expect(getAdjacentLocationIds("baghdad", edges).sort()).toEqual([
      "basra",
      "damascus",
    ]);
  });

  it("accepts adjacent moves", () => {
    expect(isAdjacentMove("baghdad", "damascus", edges)).toBe(true);
    expect(isAdjacentMove("baghdad", "cairo", edges)).toBe(false);
  });

  it("reaches land destinations within allowance", () => {
    const reachable = getReachableLocationIds("baghdad", edges, locations, {
      landMovement: 1,
      seaMovement: 0,
    });
    expect(reachable.sort()).toEqual(["basra", "damascus"]);
    expect(
      isWithinMovementAllowance("baghdad", "damascus", edges, locations, {
        landMovement: 1,
        seaMovement: 0,
      }),
    ).toBe(true);
  });

  it("requires sea budget and ports for sea travel", () => {
    expect(
      getReachableLocationIds("baghdad", edges, locations, {
        landMovement: 1,
        seaMovement: 0,
      }),
    ).not.toContain("alexandria");

    expect(
      getReachableLocationIds("baghdad", edges, locations, {
        landMovement: 1,
        seaMovement: 1,
      }),
    ).toContain("alexandria");
  });
});
