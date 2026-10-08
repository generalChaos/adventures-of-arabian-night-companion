import Link from "next/link";

export function UnauthorizedGame() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#2b2118] px-6 text-[#f8efdc]">
      <h1 className="font-[family-name:var(--font-display)] text-3xl">
        Unauthorized
      </h1>
      <p className="text-[#e8d7b5]">You are not a member of this game.</p>
      <Link href="/" className="underline">
        Back home
      </Link>
    </main>
  );
}
