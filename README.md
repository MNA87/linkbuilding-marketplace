# Linkbuilding Marketplace — Fundament (Fase 6, stap 1)

Dit is het technische fundament van de applicatie: projectstructuur, het
volledige databaseschema, authenticatie met rollen, en een werkende
basis-layout per rol (customer / supplier / admin). Dit is **stap 1** van het
afgesproken bouwplan — de vervolgstappen (seed data uitbreiden, marketplace,
bestelproces, dashboards met echte functionaliteit) volgen in latere fases,
zodat de applicatie na elke stap werkend blijft.

## Wat werkt er al

- Inloggen met e-mail/wachtwoord (Auth.js / NextAuth, wachtwoorden gehasht met bcrypt)
- Automatische doorverwijzing naar de juiste omgeving op basis van rol
- Route-beveiliging: een customer kan niet bij `/admin` of `/supplier` komen, en andersom (afgedwongen in `middleware.ts` én nogmaals server-side in elke layout — bewust dubbel, want middleware alleen is onvoldoende bescherming voor gevoelige acties)
- Drie werkende, van elkaar afgeschermde dashboards die een live telling uit de database tonen (bewijs dat de hele keten — auth → database → UI — functioneert)
- Het volledige databaseschema uit Fase 3: users, companies, rollen, websites, website-metrics, producten, website-producten, projecten, orders, order-items, placements, betalingen, facturen, publisher-uitbetalingen, categorieën, landen, talen — inclusief prijssnapshotting op order-niveau

## Wat nog NIET in deze stap zit (komt in de vervolgfases)

- De marketplace-tabel, filters en het bestelproces (Fase 6, stap 5-6)
- Supplier: websites toevoegen / producten & prijzen instellen (stap 4)
- Admin: website-approval, marges, orderbeheer (stap 3 en 9)
- Stripe-betaling (nu is er alleen het datamodel dat hier al klaar voor is)
- Echte SEO-metrics via een API (Ahrefs/Semrush) — het model (`WebsiteMetric.source`) is er al klaar voor

## Belangrijke eerlijke noot

Dit is geschreven en gecontroleerd op syntaxis, maar **niet zelf gedraaid** —
de omgeving waarin dit is gemaakt heeft geen internettoegang om
`npm install` of een database te draaien. Loop dus de stappen hieronder rustig
door; als je een foutmelding tegenkomt, stuur 'm terug en dan lossen we 'm
samen op.

## Lokaal opstarten

1. **Dependencies installeren**
   ```bash
   npm install
   ```

2. **Database klaarzetten**
   Je hebt een PostgreSQL-database nodig. Snelste opties:
   - Lokaal via [Postgres.app](https://postgresapp.com/) (Mac) of Docker
   - Gratis managed database via [Neon](https://neon.tech) of [Supabase](https://supabase.com)

   Kopieer `.env.example` naar `.env` en vul `DATABASE_URL` in:
   ```bash
   cp .env.example .env
   ```
   Genereer ook een `NEXTAUTH_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

3. **Schema naar de database wegschrijven**
   ```bash
   npx prisma validate      # controleert het schema zelf, zonder database
   npx prisma migrate dev --name init
   ```

4. **Testdata inladen**
   ```bash
   npx prisma db seed
   ```
   Dit maakt drie werkende accounts aan:
   | Rol | E-mail | Wachtwoord |
   |---|---|---|
   | Admin | admin@platform.nl | admin1234 |
   | Supplier | publisher@eigensites.nl | demo1234 |
   | Customer | contact@seobureau.nl | demo1234 |

5. **Starten**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) — je wordt naar de
   inlogpagina gestuurd, en na inloggen automatisch naar de juiste omgeving.

## Projectstructuur

```
src/
  app/
    (customer)/        → /dashboard, /marketplace (gedeelde layout, geen url-prefix)
    supplier/           → /supplier/*
    admin/              → /admin/*
    login/              → /login
    api/auth/           → NextAuth route handler
  components/
    RoleShell.tsx       → gedeelde sidebar/topbar-shell voor alle drie de rollen
  lib/
    auth.ts             → Auth.js configuratie
    prisma.ts           → database-client
  middleware.ts         → rol-gebaseerde routebeveiliging
prisma/
  schema.prisma         → volledig datamodel
  seed.ts                → testdata
```

## Volgende stap

Zodra dit lokaal draait en je tevreden bent, gaan we door met **Fase 6, stap
2-3**: de seed data uitbreiden naar iets dat op je 15 echte sites lijkt, en
het admin-paneel voor website-goedkeuring bouwen.
