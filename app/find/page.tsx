import { getPublicGyms } from "@/app/actions/public";
import { FindClient } from "@/components/find/find-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find a Gym — Pulse Directory",
  description: "Browse verified gyms. Contact directly with no fees.",
};

export default async function FindPage() {
  const { gyms = [] } = await getPublicGyms();
  return <FindClient gyms={gyms} />;
}
