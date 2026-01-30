// app/dashboard/page.js
import { getSession } from "@/lib/session";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    // Normally middleware se yahan tak aana hi nahi chahiye,
    // phir bhi safety ke liye:
    return null;
  }

  return <DashboardShell session={session} />;
}
