import { Suspense } from "react";
import { HomeClient } from "@/components/game/HomeClient";

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#2b2118] text-[#f8efdc]">
          Loading…
        </main>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
