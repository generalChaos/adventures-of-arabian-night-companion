import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#2b2118] px-6 text-[#f8efdc]">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Game not found
      </h1>
      <p className="text-[#e8d7b5]">This game no longer exists.</p>
      <Link href="/" className="underline">
        Back home
      </Link>
    </main>
  );
}
