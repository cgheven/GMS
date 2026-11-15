import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verify your account — Pulse" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return <VerifyForm token={token ?? ""} />;
}
