# Beveiligingsincident — Railway env-var lek (22-10-2026)

**Wat er speelde:** Railway meldde dat een onbevoegde derde mogelijk toegang
kreeg tot (versleutelde, en voor sommige ook ontsleutelde) **environment
variables**. Die kunnen secrets bevatten: API-sleutels, database- en
registry-credentials. Advies van Railway: **alle env-vars/secrets direct
intrekken en opnieuw uitgeven**, logs nakijken. Builds waren gepauzeerd.

> **Uitgangspunt: behandel álle onderstaande secrets als gelekt.** Vink af per
> sleutel wat je hebt (1) geroteerd en (2) in de logs gecontroleerd.

## 1. Direct roteren — bij de provider zelf (geen deploy nodig)

Dit stopt de gelekte sleutels, los van de Railway build-storing.

- [ ] **Stripe** — `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  - Roteren in Stripe dashboard (API keys + webhook signing secret).
  - Logs: ongebruikelijke betalingen, refunds, API-calls?
- [ ] **Database** — `DATABASE_URL`
  - Postgres-wachtwoord vernieuwen (Railway → Postgres-service).
  - Nieuwe `DATABASE_URL` klaarzetten voor de Railway-env-update (stap 3).
  - Logs: onbekende connecties / queries?
- [ ] **OpenAI** — `OPENAI_API_KEY`
  - Key intrekken + nieuwe aanmaken. (Railway liet AI-providers mogelijk al
    proactief intrekken — check of de oude al dood is.)
  - Logs: onverwacht verbruik?
- [ ] **Resend** — `RESEND_API_KEY`
  - Key intrekken + nieuwe. Anders kan iemand mail namens ons sturen.
  - Logs: onbekende verzendingen?
- [ ] **Opslag** — `STORAGE_ACCESS_KEY_ID` + `STORAGE_SECRET_ACCESS_KEY`
  - Access keys roteren bij de storageprovider (klant-uploads).
  - Logs: ongewone toegang / verwijderingen?
- [ ] **Back-up-opslag** — `BACKUP_STORAGE_ACCESS_KEY_ID` + `BACKUP_STORAGE_SECRET_ACCESS_KEY`
  - Access keys roteren (database-back-ups!).
  - Logs: ongewone toegang / verwijderingen?
- [ ] **Pixabay** — `PIXABAY_API_KEY` (laag risico) — vernieuwen.

> **Geen secret, niet roteren:** `EMAIL_FROM`, `NEXTAUTH_URL`,
> `STORAGE_BUCKET/ENDPOINT/REGION/PATH_STYLE`,
> `BACKUP_STORAGE_BUCKET/ENDPOINT/REGION/PATH_STYLE` — dit is config, geen
> geheim.

## 2. `NEXTAUTH_SECRET` + in-DB versleutelde secrets (zorgvuldig, vraagt deploy)

De in de database versleutelde secrets (publisher-WP app-passwords,
mailbox-wachtwoord) gebruiken een sleutel **afgeleid van `NEXTAUTH_SECRET`**
(AES-256-GCM, zie `docs/beveiliging.md`). Als `NEXTAUTH_SECRET` én
`DATABASE_URL` gelekt zijn, kan een aanvaller die ontsleutelen.

- [ ] **In-DB secrets als gecompromitteerd behandelen** en laten vernieuwen:
  - [ ] WordPress **application passwords** van de publishers (per site).
  - [ ] **Mailbox-wachtwoord** (mail-integratie).
  - [ ] Eventuele per-site opgeslagen API-sleutels.
- [ ] **`NEXTAUTH_SECRET` roteren** — LET OP: dit logt iedereen uit én maakt
  bestaande versleutelde DB-secrets onleesbaar. Vereist:
  - [ ] Kleine **migratie**: her-versleutel bestaande DB-secrets onder de
    nieuwe sleutel (of leeg + opnieuw invoeren).
  - [ ] **Deploy** (kan pas als Railway-builds terug zijn).
  - [ ] Daarna: iedereen opnieuw inloggen (verwacht gedrag).

## 3. Railway-kant — nieuwe waarden invoeren

- [ ] Railway-connector **opnieuw koppelen** (claude.ai → Connectors) zodat
  Claude de env kan lezen/zetten.
- [ ] Nieuwe sleutels als env-vars in Railway zetten (service `web`).
- [ ] Service **herstarten** zodat de app de nieuwe waarden inleest
  (restart ≠ rebuild; test of dit werkt tijdens de build-pauze).
- [ ] Zodra **builds hervat** zijn: volledige deploy van de laatste `main`
  (bevat ook de UI-fixes die al klaarstonden) + de `NEXTAUTH_SECRET`-migratie.
- [ ] Railway-incident volgen op status.railway.com tot "resolved".

## 4. Afronden

- [ ] Alle bovenstaande vinkjes gezet en logs schoon bevonden.
- [ ] Korte notitie in `docs/beveiliging.md` dat de rotatie is uitgevoerd
  (datum + welke sleutels).
- [ ] Admin → Livegang: eventueel een punt toevoegen/afvinken.

---
*Opgesteld 22-10-2026 n.a.v. de Railway-melding. Werk dit bij terwijl je de
stappen doorloopt.*
