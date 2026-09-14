# Linkbuilding Marketplace

Next.js (App Router) + Prisma + NextAuth marketplace waar customers backlinks
inkopen bij publishers. Betalingen lopen via Stripe Connect (Express): het
platform houdt de marge in, de rest wordt automatisch doorbetaald aan de
publisher.

## Lokaal opstarten

1. **Dependencies installeren**
   ```bash
   npm install
   ```

2. **Env-variabelen**
   ```bash
   cp .env.example .env
   ```
   Vul `.env` in — zie hieronder per dienst wat je nodig hebt. Minimaal
   vereist om de app te laten *starten*: `DATABASE_URL`, `NEXTAUTH_SECRET`,
   `NEXTAUTH_URL`. De rest (Stripe/Resend/Sentry/Storage) mag leeg zijn
   tijdens lokale ontwikkeling — die features falen dan netjes met een
   duidelijke foutmelding in plaats van de app te laten crashen.

3. **Database migreren**
   ```bash
   npx prisma migrate deploy   # bestaande migraties toepassen
   ```
   Voor nieuwe schema-wijzigingen tijdens ontwikkeling: `npx prisma migrate dev --name <naam>`.
   **Gebruik nooit `prisma db push`** — migraties staan in
   `prisma/migrations` en horen gecommit te worden.

4. **Testdata inladen**
   ```bash
   npx prisma db seed
   ```
   Dit maakt een admin-, supplier- en customer-account aan met **willekeurig
   gegenereerde wachtwoorden**, die één keer in je terminal worden getoond.
   Ze worden nergens opgeslagen — als je ze kwijtraakt, reset je het
   wachtwoord via "Wachtwoord vergeten" op de inlogpagina, of je runt de seed
   opnieuw (bestaande accounts met dat e-mailadres worden niet overschreven).

5. **Starten**
   ```bash
   npm run dev
   ```
   [http://localhost:3000](http://localhost:3000) stuurt je naar `/login`.

## Env-variabelen — wat moet je zelf regelen

| Variabele | Waarvoor | Waar vandaan |
|---|---|---|
| `DATABASE_URL` | Postgres-connectie | Railway Postgres service → Variables |
| `NEXTAUTH_SECRET` | Sessie-encryptie | `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Betalingen + Connect | [Stripe dashboard → API keys](https://dashboard.stripe.com/test/apikeys) |
| `STRIPE_WEBHOOK_SECRET` | Webhook-verificatie | [Stripe dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks), endpoint `/api/stripe/webhook` |
| `RESEND_API_KEY` | Transactionele e-mail | [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | Afzenderadres | Moet op een in Resend geverifieerd domein staan |
| `STORAGE_*` | Bestandsuploads (order-bijlagen) | S3-compatible bucket, bv. een Railway bucket |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Errortracking | [sentry.io](https://sentry.io) → project → Client Keys (DSN) |

### Stripe — instellingen die jij zelf moet activeren

Dit platform gebruikt **Stripe Connect (Express)**, niet gewone Checkout:

1. Activeer **Connect** in je Stripe dashboard (Settings → Connect), kies
   platform-type "Marketplace".
2. Zet in **Connect → Settings** welke landen/valuta je toestaat voor
   publishers die zich aanmelden.
3. Maak de webhook aan (zie tabel hierboven) met events:
   `checkout.session.completed`, `checkout.session.expired`, `account.updated`.
4. Zolang je in **test mode** zit werkt alles met testkaarten
   ([stripe.com/docs/testing](https://stripe.com/docs/testing)) — voor
   productie moet je Stripe-account geactiveerd worden (bedrijfsgegevens,
   KVK, bankrekening) via het live dashboard.
5. Publishers verbinden hun eigen Stripe-account zelf via
   **Supplier → Account → Verbind Stripe-account** — daar hoef jij niets
   voor te doen.

### Resend

Voeg je verzenddomein toe en verifieer de DNS-records
([resend.com/domains](https://resend.com/domains)) voordat je `EMAIL_FROM`
op dat domein zet — anders weigert Resend de e-mail.

### Sentry

Maak een project aan (type: Next.js), kopieer de DSN naar zowel `SENTRY_DSN`
als `NEXT_PUBLIC_SENTRY_DSN`. `SENTRY_ORG`/`SENTRY_PROJECT` zijn optioneel,
alleen nodig als je source maps wilt uploaden bij een build.

## Deployment (Railway)

- **preDeployCommand** moet `npx prisma migrate deploy` zijn (niet
  `db push`) — zet dit in de Railway service-instellingen onder Deploy.
- Zet alle env-variabelen uit de tabel hierboven op de `web`-service in
  Railway (production-omgeving).
- `/api/health` checkt echte database-connectiviteit — koppel deze aan een
  externe uptime-monitor (bv. UptimeRobot, Better Uptime).

## Wat nog jouw (zakelijke/juridische) beslissing is

- **`/privacy` en `/voorwaarden`**: bevatten nu een placeholder met TODO.
  De daadwerkelijke tekst moet je zelf (of met een jurist) opstellen.
- **Stripe-accountactivatie**: het aanmaken/verifiëren van je eigen
  platform-Stripe-account (KVK, bankrekening, BTW-instellingen) kan alleen
  jij doen.
- **Domeinregistratie + DNS** voor Resend/productie-URL.
- **BTW-instellingen** in Stripe (welk BTW-tarief je rekent, of je
  reverse-charge toepast bij zakelijke klanten) — technisch is dit niet
  geautomatiseerd, dat vereist een boekhoudkundige/fiscale beslissing.

## Projectstructuur

```
src/
  app/
    (customer)/           → /dashboard, /marketplace (klant-rol)
    supplier/              → /supplier/* (publisher-rol)
    admin/                 → /admin/*
    login/, register/,
    forgot-password/,
    reset-password/        → auth-pagina's
    privacy/, voorwaarden/ → placeholder legal pages
    api/
      auth/[...nextauth]/  → NextAuth
      stripe/webhook/      → Stripe Connect webhook
      upload/               → order-bijlage upload (gevalideerd, S3)
      health/               → uptime-monitor endpoint
  components/
  lib/
    auth.ts                → NextAuth config + rate limiting
    pricing.ts              → marge-berekening (PricingRule / default 30%)
    stripe.ts, email.ts, upload.ts, rateLimit.ts
    validations/            → Zod-schema's
  instrumentation.ts,
  instrumentation-client.ts → Sentry init (server/edge + client)
  proxy.ts                  → rol-gebaseerde routebeveiliging (voorheen middleware.ts)
prisma/
  schema.prisma
  migrations/                → gebruik `migrate dev`/`migrate deploy`, nooit `db push`
  seed.ts                    → testdata met eenmalig getoonde random wachtwoorden
```

## Beveiliging — wat al is afgedekt

- Elke server action/API-route controleert de rol expliciet (niet alleen
  `proxy.ts`), met name bij alles wat prijzen, marges of geld raakt.
- Rate limiting op login (5 pogingen/minuut per IP+e-mail) en op
  wachtwoord-vergeten-aanvragen.
- Alle formulierinvoer wordt met Zod gevalideerd vóór het de database in gaat.
- Bestandsuploads: whitelist van toegestane types, max 10MB, nooit
  uitvoerbare bestanden; opgeslagen buiten een publiek bucket, alleen
  bereikbaar via kortlevende signed URLs.
- `npm audit`: 0 kwetsbaarheden (Next.js is geüpgraded naar v16 om de
  eerder aanwezige critical/high advisories op te lossen).
- `next build` faalt nu écht op TypeScript- en lint-fouten (niet meer
  stilzwijgend genegeerd).
