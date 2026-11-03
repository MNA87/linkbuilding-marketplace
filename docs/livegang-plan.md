# Livegang-plan — richtdatum 14 november 2026

Oorspronkelijk stond livegang op **2 november**; die is verschoven naar
**vrijdag 14 november 2026**. Dit plan zet een tijdlijn (±14 dagen) over het
werk dat nog moet.

> **Bron van waarheid blijft `Admin → Planning → Livegang`** (de launch-,
> beveiligings- en Nice-to-have-lijst). Dit bestand dupliceert die lijst niet,
> maar plant de volgorde en bewaakt de datum. Zie ook `docs/beveiliging.md`
> (controle 2-10-2026) voor de open beveiligingspunten.

## Werkwijze (vast)
- Valideren met `npm run build` én `npx tsc --noEmit` (beide groen) vóór elke push.
- Pushen/deployen alleen op expliciet "push"; daarna de Railway-deploy volgen tot SUCCESS.
- Backups draaien (elk uur) — vóór livegang nog één keer bevestigen.

## Wat moet er nog? (3 sporen)

### A. Beveiliging — code (afgebakend)
Uit `docs/beveiliging.md`, Livegang stap 4 "Veiligheid en controle":
1. **Admin-sessie korter** — nu 30 dagen (NextAuth-standaard) → **1 dag**.
2. **Mail bij admin-inlog** — melding wanneer een admin inlogt.
3. **Account op slot na 10 foute pogingen** — per account (niet alleen per IP) + waarschuwingsmail.
4. **WP-plugin-sleutel uit de URL** — nu `?secret=`, beter als **header**; vraagt een nieuwe pluginversie.
5. *Nice-to-have (als er tijd is):* registratie verklapt niet of een e-mail al bestaat; `style`-filter in artikelen strenger.
- *(2FA voor admin zit al in de code.)*

### B. Beveiliging — zelf doen (ops, geen code) — **vóór livegang**
- **2FA aan** op Railway, GitHub, SiteGround en mail.
- **Sterk, uniek admin-wachtwoord** (16+ uit een wachtwoordmanager).

### C. Domein overzetten naar `publito.nl` (grote klus)
- Custom domein + SSL in Railway (domein toevoegen, DNS instellen).
- `NEXTAUTH_URL` / basis-URL + absolute links in e-mails.
- Mail-afzender/reply-adres en resterende hardcoded "Nugevonden"-teksten → Publito.
- Redirect oud domein → nieuw.

## Tijdlijn

| Dag | Datum | Werk |
|-----|-------|------|
| — | ma 3 nov | Plan vastgelegd (dit bestand). |
| 1 | di 4 nov | **A1 + A2**: admin-sessie naar 1 dag + mail bij admin-inlog. |
| 2 | wo 5 nov | **A3**: account-lock na 10 pogingen (per account) + waarschuwingsmail. |
| 3 | do 6 nov | **A4**: WP-plugin-sleutel als header (code + nieuwe pluginversie afstemmen). Kan uitlopen. |
| 4 | vr 7 nov | **A5** nice-to-have + `npm audit` + security afronden/buffer. |
| — | wkd 8–9 nov | Buffer / licht. |
| 5 | ma 10 nov | **C** voorbereiding: "Nugevonden"-teksten → Publito, `NEXTAUTH_URL`/basis-URL, mail-afzender. |
| 6 | di 11 nov | **C** uitvoeren: Railway custom domein + SSL + DNS, redirect oud→nieuw, absolute mail-links. |
| 7 | wo 12 nov | **Admin → Livegang** stap-voor-stap samen doorlopen; open punten wegwerken. Jij: **B** (2FA + admin-wachtwoord). |
| 8 | do 13 nov | **Eindcontrole**: smoke test (registratie → bestellen → betalen → inhoud aanleveren → publisher-flow → live-URL), backups bevestigen, `npm audit`, laatste fixes. Buffer. |
| 9 | **vr 14 nov** | **LIVEGANG**: finale deploy, domein live, redirect actief, kort monitoren. |

## Go-live checklist (14 nov)
- [ ] `npm run build` + `npx tsc --noEmit` groen; laatste deploy SUCCESS.
- [ ] Alle A-punten (en zo mogelijk A5) afgerond; B-punten (ops) gedaan.
- [ ] `publito.nl` live met SSL; `NEXTAUTH_URL`/basis-URL juist; mails met correct afzender + domein.
- [ ] Redirect oud domein → `publito.nl` actief.
- [ ] Geen hardcoded "Nugevonden" meer zichtbaar voor gebruikers.
- [ ] Admin → Livegang stap 4 afgevinkt; `docs/beveiliging.md` bijgewerkt.
- [ ] Backups draaien (laatste run < 1 uur); `npm audit` schoon of bekend-onschadelijk.
- [ ] Smoke test van de hele klant- én publisher-flow geslaagd.

## Risico's / aandachtspunten
- **Domein-overzetten** is qua tijd het grootste risico (DNS-propagatie, SSL, mail-afzender). Daarom al in week 2, met buffer erna.
- **WP-plugin-sleutel als header** vraagt een nieuwe pluginversie bij de uitgevers — afhankelijkheid buiten deze repo; op tijd afstemmen.
- Admin → Livegang kan punten bevatten die hier nog niet staan — die lijst is leidend; dit plan bijwerken zodra we 'm samen doorlopen.
