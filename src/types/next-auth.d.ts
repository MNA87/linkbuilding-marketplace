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
    // When this login was made (ms); an admin login lasts a day.
    loginAt?: number;
  }
}
