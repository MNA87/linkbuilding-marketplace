import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Account aanmaken" };

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  // Just the form, on a light background: quick to fill in.
  return (
    <div className="flex min-h-screen flex-col items-center bg-brandSoft/40 px-4 py-10 sm:py-14">
      <Link href="/" className="mb-6 font-serif text-[22px] text-ink">
        Nugevonden
      </Link>
      <main className="w-full max-w-[560px] rounded-3xl bg-surface px-6 py-8 shadow-sm sm:px-12 sm:py-10">
        <RegisterForm />
      </main>
    </div>
  );
}
