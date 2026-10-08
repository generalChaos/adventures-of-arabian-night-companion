import { redirect } from "next/navigation";

type Props = { params: Promise<{ code: string }> };

export default async function JoinRedirectPage({ params }: Props) {
  const { code } = await params;
  redirect(`/?join=${encodeURIComponent(code)}`);
}
