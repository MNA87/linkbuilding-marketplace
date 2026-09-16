import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4 py-12">
      <div className="w-full max-w-md bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Account aanmaken</h1>
        <RegisterForm />
        <p className="text-sm text-inkSoft mt-6">
          Heb je al een account?{" "}
          <a href="/login" className="text-brand hover:underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
