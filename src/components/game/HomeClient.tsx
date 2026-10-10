"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createGameAction, joinGameAction } from "@/application/commands/actions";

const DEFAULT_EDITION_ID = "11111111-1111-4111-8111-111111111111";

export function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialJoin = (searchParams.get("join") ?? "").toUpperCase();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoin);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      const result = await createGameAction({
        editionId: DEFAULT_EDITION_ID,
        displayName,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/game/${result.snapshot.game.id}`);
    });
  }

  function join() {
    setError(null);
    startTransition(async () => {
      const result = await joinGameAction({ joinCode, displayName });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/game/${result.snapshot.game.id}`);
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_20%,#f6e7c8,transparent_40%),radial-gradient(circle_at_80%_0%,#e8c48a,transparent_35%),linear-gradient(160deg,#2b2118,#4a3420)] text-[#f8efdc]">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-10 px-6 py-16">
        <div>
          <p className="mb-3 text-sm uppercase tracking-[0.25em] text-[#e2c89a]">
            Remote companion
          </p>
          <h1 className="max-w-xl font-[family-name:var(--font-display)] text-5xl leading-tight md:text-6xl">
            Adventures of the Tales of Arabian Nights
          </h1>
          <p className="mt-4 max-w-lg text-lg text-[#e8d7b5]">
            A shared digital table for friends in different places — one board,
            one turn state, no duplicated bookkeeping.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#c9a978]/40 bg-[#1f1812]/70 text-[#f8efdc] backdrop-blur">
            <CardHeader>
              <CardTitle>New game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onValueChange={setDisplayName}
                  placeholder="Rico"
                  className="bg-[#2b2118] text-[#f8efdc]"
                />
              </div>
              <Button
                onClick={create}
                disabled={pending || !displayName.trim()}
                className="w-full"
              >
                Create game
              </Button>
            </CardContent>
          </Card>

          <Card className="border-[#c9a978]/40 bg-[#1f1812]/70 text-[#f8efdc] backdrop-blur">
            <CardHeader>
              <CardTitle>Join game</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="code">Join code</Label>
                <Input
                  id="code"
                  value={joinCode}
                  onValueChange={(v) => setJoinCode(v.toUpperCase())}
                  placeholder="Q7K4PM"
                  className="bg-[#2b2118] text-[#f8efdc]"
                />
              </div>
              <Button
                variant="secondary"
                onClick={join}
                disabled={pending || !displayName.trim() || !joinCode.trim()}
                className="w-full"
              >
                Join
              </Button>
            </CardContent>
          </Card>
        </div>

        {error ? (
          <p className="rounded border border-red-400/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
            {error}
            {error.toLowerCase().includes("database") ||
            error.toLowerCase().includes("supabase") ||
            error.toLowerCase().includes("env")
              ? " — set .env.local from .env.example and apply migrations."
              : null}
          </p>
        ) : (
          <p className="text-sm text-[#cbb892]">
            Requires Supabase + DATABASE_URL. See docs/tasks.md Phase 0.
          </p>
        )}
        <footer>TEST</footer>
      </div>
    </main>
  );
}
