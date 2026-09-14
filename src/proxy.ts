import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Eén centrale plek die bepaalt wie bij welke routegroep mag. Dit is de
// eerste verdedigingslinie — individuele server actions/API-routes moeten
// de rol daarnaast ZELF ook controleren, want middleware alleen is niet
// genoeg om gevoelige acties (bijv. marges aanpassen) af te schermen.
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const roleForPath = pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/supplier")
        ? "supplier"
        : pathname.startsWith("/dashboard") || pathname.startsWith("/marketplace")
          ? "customer"
          : null;

    if (roleForPath && role !== roleForPath) {
      // Ingelogd, maar de verkeerde rol: terug naar de eigen startpagina
      // i.p.v. een generieke 403, dat is minder verwarrend voor de gebruiker.
      const home = role === "admin" ? "/admin" : role === "supplier" ? "/supplier" : "/dashboard";
      return NextResponse.redirect(new URL(home, req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Alleen "is er een geldige sessie" — de rol-check zelf gebeurt
      // hierboven, zodat we een nette redirect kunnen geven i.p.v. een
      // automatische afwijzing.
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/marketplace/:path*", "/supplier/:path*", "/admin/:path*"],
};
