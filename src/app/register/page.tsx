import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AuthCard from "@/components/AuthCard";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Account aanmaken" };

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  // Just the form, on a light background: quick to fill in.
  return (
    <AuthCard wide>
      <RegisterForm />
    </AuthCard>
  );
}
