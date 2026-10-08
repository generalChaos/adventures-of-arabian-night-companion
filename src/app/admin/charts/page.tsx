import { Suspense } from "react";
import { AdminChartsClient } from "@/components/content/AdminChartsClient";

export default function AdminChartsPage() {
  return (
    <Suspense fallback={<main className="p-10">Loading charts…</main>}>
      <AdminChartsClient />
    </Suspense>
  );
}
