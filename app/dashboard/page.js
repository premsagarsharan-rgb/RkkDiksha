// app/dashboard/page.js
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardPage() {
  const session = await getSession();

  // ✅ blank return mat karo, direct login bhejo
  if (!session) {
    redirect("/login");
  }

  return <DashboardShell session={session} />;
}
