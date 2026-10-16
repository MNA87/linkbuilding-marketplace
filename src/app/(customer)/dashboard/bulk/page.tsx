import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import BulkDemo from "./BulkDemo";

export const metadata: Metadata = { title: "Bulk bestellen (preview)" };

// A clickable preview of the agency bulk-order flow (see
// docs/nice-to-have/agency-module.md). Front-end only — it places no real
// order yet; it's here so the flow and feel can be judged in the live app.
export default async function BulkDemoPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "customer") redirect("/login");
  return <BulkDemo />;
}
