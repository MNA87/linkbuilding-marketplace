import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) redirect("/login");

  const home =
    session.user.role === "admin" ? "/admin" : session.user.role === "supplier" ? "/supplier" : "/dashboard";
  redirect(home);
}
