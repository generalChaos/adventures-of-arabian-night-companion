import { Suspense } from "react";
import { AdminContentClient } from "@/components/content/AdminContentClient";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="p-10">Loading admin…</main>}>
      <AdminContentClient />
    </Suspense>
  );
}
