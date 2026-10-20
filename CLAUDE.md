@AGENTS.md

# Start hier — werkwijze & bronnen

Lees dit voor je begint. Deze afspraken gelden bovenop de rest.

- **Taal:** antwoord in het Nederlands.
- **Nooit committen of pushen zonder expliciet "push"** van de gebruiker.
  Werk op de afgesproken feature-branch, valideer met `npm run build` én
  `npx tsc --noEmit` (beide groen) vóór een push, fast-forward `main` pas op
  sein, en volg daarna de Railway-deploy tot SUCCESS.
- **Bronnen van waarheid — lees deze, vertrouw niet op geheugen:**
  - `PRODUCT.md` — hoe we bouwen (werkprincipes + ontwerp-DNA).
  - `PLANNING.md` — ontwerp-/dev-backlog en toekomstitems.
  - **Admin → Livegang** (in de app) — de levende livegang-/afrondingslijst
    én Nice-to-have. Dít is de bron voor launch- en beveiligingsstatus; een
    losse DB-kopie kan verouderd zijn.
  - `docs/beveiliging.md` — beveiligingscontrole en -status.
- **Status/livegang/beveiliging gevraagd?** Check eerst de **code +
  git-historie** en bovenstaande bronnen, niet je herinnering of een kopie.
  (Lange gesprekken worden samengevat — details vervagen; de repo niet.)
- **Rond werk af door de bronnen bij te werken:** `PLANNING.md` ("Gedaan")
  en de Admin → Livegang-status, zodat niks verjaart.
- **Deze Next.js is een fork** (zie AGENTS.md): lees de gids in
  `node_modules/next/dist/docs/` vóór je Next-code schrijft.
