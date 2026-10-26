import { redirect } from "next/navigation";

// De oude winkelmandje-pagina is uitgefaseerd. Bestellen, verlengen en
// afrekenen lopen volledig via de nieuwe flow (/dashboard/marketplace) — een
// bureau op rekening, een reguliere klant via Stripe. Eventuele oude links of
// bookmarks komen hier zo altijd op de juiste plek uit, zodat het oude
// cart-scherm nergens meer verschijnt.
export default async function CartPage() {
  redirect("/dashboard/marketplace");
}
