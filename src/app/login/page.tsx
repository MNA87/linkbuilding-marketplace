import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-brandSoft/30 px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-lg p-8">
        <h1 className="font-serif text-2xl text-ink mb-1">Inloggen</h1>
        <p className="text-sm text-inkSoft mb-6">Log in op je Backlink Exchange-account.</p>
        <LoginForm />
        <p className="text-sm text-inkSoft mt-6">
          Nog geen account?{" "}
          <a href="/register" className="text-brand hover:underline">
            Registreer je
          </a>
        </p>
      </div>
    </div>
  );
}
