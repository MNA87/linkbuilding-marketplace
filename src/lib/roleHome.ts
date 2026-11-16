// Waar een ingelogde gebruiker begint, per rol. Gebruikt na het inloggen en
// als een ingelogde bezoeker op de homepage, /login of /register komt — zo
// verschijnt de publieke site (publito.nl) niet even tussendoor.
export function roleHome(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "supplier") return "/supplier";
  return "/marketplace";
}
