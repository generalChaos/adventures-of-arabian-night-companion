"use client";

import { useState } from "react";
import type { BoardEdge, BoardLocation, GamePlayer, PlayerState } from "@/domain/game/types/game";
import { getReachableLocationIds } from "@/domain/game/rules/movement";

type Props = {
  locations: BoardLocation[];
  edges: BoardEdge[];
  players: GamePlayer[];
  playerStates: PlayerState[];
  selectedPlayerId: string | null;
  highlightAdjacent?: boolean;
  onSelectDestination?: (locationId: string) => void;
};

const WIDTH = 1000;
const HEIGHT = 640;

export function BoardViewport({
  locations,
  edges,
  players,
  playerStates,
  selectedPlayerId,
  highlightAdjacent = false,
  onSelectDestination,
}: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  const selectedState = playerStates.find((s) => s.gamePlayerId === selectedPlayerId);
  const adjacent =
    highlightAdjacent && selectedState?.currentLocationId
      ? new Set(
          getReachableLocationIds(
            selectedState.currentLocationId,
            edges,
            locations,
            {
              landMovement: selectedState.landMovement ?? 1,
              seaMovement: selectedState.seaMovement ?? 0,
            },
          ),
        )
      : new Set<string>();

  const playersByLocation = new Map<string, GamePlayer[]>();
  for (const state of playerStates) {
    if (!state.currentLocationId) continue;
    const player = players.find((p) => p.id === state.gamePlayerId);
    if (!player) continue;
    const list = playersByLocation.get(state.currentLocationId) ?? [];
    list.push(player);
    playersByLocation.set(state.currentLocationId, list);
  }

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-[#c9a978] bg-[#cbb892]"
      data-testid="board-viewport"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(90,140,170,0.35),transparent_45%),radial-gradient(ellipse_at_80%_20%,rgba(214,180,120,0.45),transparent_40%),linear-gradient(180deg,#e8d7b0_0%,#d2b88a_55%,#c4a574_100%)]" />
      <div className="absolute right-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          className="rounded bg-[#fff8ec]/90 px-2 py-1 text-sm shadow"
          onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
        >
          +
        </button>
        <button
          type="button"
          className="rounded bg-[#fff8ec]/90 px-2 py-1 text-sm shadow"
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
        >
          −
        </button>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="relative z-[1] h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => setDragging({ x: e.clientX - pan.x, y: e.clientY - pan.y })}
        onPointerMove={(e) => {
          if (!dragging) return;
          setPan({ x: e.clientX - dragging.x, y: e.clientY - dragging.y });
        }}
        onPointerUp={() => setDragging(null)}
        onPointerLeave={() => setDragging(null)}
      >
        <defs>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map((edge) => {
            const from = locations.find((l) => l.id === edge.fromLocationId);
            const to = locations.find((l) => l.id === edge.toLocationId);
            if (!from || !to) return null;
            const isSea = edge.connectionType === "SEA";
            return (
              <line
                key={edge.id}
                x1={from.x * WIDTH}
                y1={from.y * HEIGHT}
                x2={to.x * WIDTH}
                y2={to.y * HEIGHT}
                stroke={isSea ? "#2f6f9a" : "#5c4020"}
                strokeWidth={isSea ? 3 : 2.25}
                strokeDasharray={isSea ? "7 5" : undefined}
                opacity={isSea ? 0.75 : 0.55}
              />
            );
          })}

          {locations.map((loc) => {
            const cx = loc.x * WIDTH;
            const cy = loc.y * HEIGHT;
            const isHighlight = adjacent.has(loc.id);
            const isPort = loc.isPort;
            return (
              <g
                key={loc.id}
                data-testid={`location-${loc.slug}`}
                transform={`translate(${cx} ${cy})`}
                className={isHighlight ? "cursor-pointer" : undefined}
                onPointerDown={(e) => {
                  if (!isHighlight) return;
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  if (!isHighlight || !onSelectDestination) return;
                  e.stopPropagation();
                  onSelectDestination(loc.id);
                }}
              >
                {isHighlight ? (
                  <circle
                    r={22}
                    fill="none"
                    stroke="#e8b84a"
                    strokeWidth={2}
                    opacity={0.9}
                  >
                    <animate
                      attributeName="r"
                      values="18;24;18"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.9;0.35;0.9"
                      dur="1.6s"
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
                <circle
                  r={isHighlight ? 16 : 12}
                  fill={isHighlight ? "#f5d76e" : isPort ? "#dce9f2" : "#f8f1e3"}
                  stroke="#3b2f1e"
                  strokeWidth={2}
                  filter={isHighlight ? "url(#softGlow)" : undefined}
                />
                {isPort ? (
                  <circle r={4} cy={0} fill="#2f6f9a" opacity={0.85} />
                ) : null}
                <text
                  y={-22}
                  textAnchor="middle"
                  className="fill-[#2a2114]"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  {loc.name}
                </text>
                {(playersByLocation.get(loc.id) ?? []).map((player, index, arr) => {
                  const offset = (index - (arr.length - 1) / 2) * 14;
                  return (
                    <circle
                      key={player.id}
                      cx={offset}
                      cy={18}
                      r={7}
                      fill={player.playerColor}
                      stroke="#fff"
                      strokeWidth={1.5}
                    >
                      <title>{player.displayName}</title>
                    </circle>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
