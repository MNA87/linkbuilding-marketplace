# Beveiligingscontrole (2-10-2026)

Controle van de code op wachtwoorden, inloggen, rechten, geheimen en kwetsbare onderdelen. De
open punten staan op Admin → Planning (Livegang, stap 4 "Veiligheid en controle", en Nice to have).

## Wat goed geregeld is

- **Wachtwoorden**
  - Alleen als bcrypt-hash (sterkte 12) opgeslagen, nooit leesbaar.
  - Eisen: minimaal 10 tekens, met een hoofdletter, een kleine letter en een cijfer.
- **Inloggen**
  - Na 5 mislukte pogingen per minuut (per internetadres + e-mailadres) geblokkeerd.
  - Een wachtwoordwijziging of -reset laat alle eerdere inlogs vervallen (sessionVersion).
  - Een geblokkeerd of verwijderd account is direct uitgelogd.
- **Wachtwoord vergeten:** de link is 15 minuten geldig, eenmalig, en alleen als hash opgeslagen.
- **E-mailadres wijzigen:** pas na bevestiging via het nieuwe adres.
- **Rechten**
  - Iedere pagina en iedere server action controleert zelf de rol (admin / klant), naast de
    middleware (`src/proxy.ts`).
  - Klantacties controleren ook of de order van die klant is.
  - Facturen, artikelafbeeldingen en de data-export alleen voor de eigenaar of admin.
- **Geheimen**
  - API-sleutels en het mailbox-wachtwoord staan versleuteld in de database (AES-256-GCM, sleutel
    afgeleid van `NEXTAUTH_SECRET`, die alleen in Railway staat).
  - Niets staat in de code of in GitHub; `.env` wordt niet meegecommit.
- **Invoer**
  - Artikelteksten worden altijd opgeschoond (sanitize-html) voordat ze worden opgeslagen of
    getoond: bij klant, admin, AI-schrijven en Word uit mail.
- **Overige beveiliging**
  - **Uploads:** soort en grootte worden gecontroleerd; ze staan privé in de opslag en zijn
    alleen te openen via een tijdelijke link.
  - **Stripe:** de webhook controleert de handtekening.
  - **Headers:** CSP, HSTS, geen framing, nosniff.
  - **Server actions:** Next.js controleert zelf de herkomst (bescherming tegen CSRF).

## Direct opgelost bij deze controle

- **Next.js 16.3.5 → 16.3.8:** beveiligingsupdate. Het lek (next/og) gebruikt het platform niet,
  maar is toch dichtgezet.
- **Binnengekomen:** een Word-bijlage boven 10 MB wordt niet ingelezen, zodat een gemaakte bijlage
  de server niet kan vastzetten.

## Open punten (op de Planning)

Livegang, stap 4:

1. **Tweestapsverificatie aan op Railway, GitHub, SiteGround en mail** (zelf doen). Wie daar
   binnenkomt, heeft alles; via de mail kan iemand ook een wachtwoordreset doen.
2. **Admin-wachtwoord lang en uniek** (zelf doen), bijvoorbeeld 16+ tekens uit een
   wachtwoordmanager.
3. **Tweestapsverificatie voor admin** (stond al). Belangrijkste punt in de code.
4. **Admin-inlog korter geldig (1 dag).** Nu 30 dagen (NextAuth-standaard). Hoort bij
   "Sessiebeveiliging".
5. **Account op slot na 10 foute inlogpogingen**, met een mail. De huidige blokkade werkt per
   internetadres; met veel adressen kan iemand blijven raden.
6. **Mail bij inloggen als admin**, zodat je ziet wanneer iemand anders binnenkomt.
7. **Geheime sleutel WP-plugin niet meer in de URL.** De sleutel staat nu in `?secret=` en kan zo
   in serverlogs belanden. Beter als header; daar is een nieuwe pluginversie voor nodig.

Nice to have:

- **Registratie verklapt niet of een e-mailadres al bestaat.** Nu zegt het formulier "Er bestaat
  al een account". Klein risico, gangbaar gedrag.
- **Opmaak in artikelen strenger filteren:** het `style`-attribuut is nu op alle elementen
  toegestaan. Scripts kunnen niet (CSP en sanitize), maar opmaak kan misleidend gebruikt worden.

## Kwetsbare onderdelen (npm audit, 2-10-2026)

Na de Next.js-update blijven er vier meldingen over. Geen daarvan is via het platform te misbruiken:

- **`brace-expansion` en `fast-uri`:** alleen in bouwgereedschap (Sentry/webpack), niet op de
  live site.
- **`nodemailer` via `next-auth`:** next-auth gebruikt het alleen voor inloggen per e-maillink,
  en dat gebruikt het platform niet. De `nodemailer` die `mailparser` gebruikt (10.0.13) is
  bijgewerkt.

Elke maand `npm audit` draaien (hoort bij "Regelmatige systeemupdate").
