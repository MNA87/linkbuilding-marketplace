import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      companyId: string | null;
      companyName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: string;
    companyId: string | null;
    companyName: string | null;
    sessionVersion: number;
    remember: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    companyId: string | null;
    companyName: string | null;
    // Missing on logins from before it existed: counts as 0.
    sessionVersion?: number;
    // When this login was made (ms); an admin login lasts a day, and so does
    // one without "Onthoud mij" (missing on older logins: remembered).
    loginAt?: number;
    remember?: boolean;
  }
}
