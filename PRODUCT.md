# Product- & ontwerpkompas

Dit is het levende kompas voor hoe we dit platform bouwen. Het legt onze
manier van werken en onze lat vast, zodat elke sessie — nu en later — in
dezelfde stijl en op hetzelfde niveau doorbouwt. Voel je vrij het bij te
werken; als onze voorkeuren schuiven, schuift dit mee.

**Ambitie:** het beste platform in de markt. Niet met één gouden feature,
maar met consistentie — elk scherm klopt, niks is overbodig, en het denkt
mee met de klant.

## Werkprincipes

1. **Klant eerst.** Beoordeel elke feature vanuit "wat ziet en doet de klant
   op dit scherm". De techniek volgt het klantdoel, niet andersom.
2. **Laat het zien.** Iets visueels eerst als mockup/screenshot; pas bouwen
   na akkoord. Toon hoe het er écht uit komt te zien, met echte data.
3. **Klein en gecontroleerd.** Werk in kleine, afgeronde stappen. Altijd
   `npm run build` + `npx tsc --noEmit` groen vóór een push. **Nooit live
   zonder expliciet "push".**
4. **Clean & consistent.** Snoei wat niks toevoegt. Gebruik dezelfde tokens
   en patronen. Let op de kleine dingen die "af" laten voelen: uitlijning,
   rust, enkelvoud/meervoud, geen dubbele of overbodige meldingen.
5. **Denk op schaal en randgevallen.** Vraag standaard "wat als er 50 zijn?"
   en "wat bij 0, 1 of 2?". Bouw de UI zo dat ze meebeweegt (bv. chips bij
   weinig items, dropdown bij veel).
6. **Benoem de grote keuze achter een kleine tweak.** Als een los verzoek
   eigenlijk een richtingkeuze verbergt, leg die keuze expliciet voor.

## Zo werken we samen

- **Mockup → akkoord → bouwen → valideren → push → deploy volgen.**
- De gebruiker houdt de regie over richting en tempo; ik bouw en keur niets
  zelf goed voor livegang.
- Reageer in het **Nederlands**.
- Bij twijfel over een ontwerprichting: kom met 2–3 concrete varianten in de
  echte stijl, met een duidelijk advies — geen eindeloze opsomming.

## Technische werkafspraken

- **Deze Next.js is een fork met breaking changes.** Lees de relevante gids
  in `node_modules/next/dist/docs/` vóór je Next-code schrijft. Het
  agent-files-blok in `AGENTS.md` wordt door `next dev` beheerd.
- **Valideren vóór push:** `npm run build` én `npx tsc --noEmit` groen.
- **Deploy:** Railway bouwt vanaf `main` (preDeploy draait
  `npx prisma migrate deploy`). Na een push de deploy volgen tot SUCCESS.
- `.env` is gitignored (lokaal DB-wachtwoord) — nooit committen.

## Ontwerp-DNA

- **Typografie:** koppen in Georgia (serif), lopende tekst in de systeem-
  sans. Rustige hiërarchie, geen schreeuwerige hero's.
- **Kleur (design tokens):** `ink #1a1a1a`, `inkSoft #6b7280`,
  `surface #fff`, `line #e5e7eb`, `brand #0d9488` (teal), `brandSoft #f0fdfa`.
  De **actieknop-kleur** is admin-instelbaar via `--btn-pay-bg` (bosgroen in
  deze omgeving). Zandtint voor "op rekening"-accenten:
  `bg #f0ebe0 / border #e3d9c2 / tekst #3f3a2f`.
- **Spaarzaam met kleur.** De groene CTA (en het groene randje) zijn het
  sterkste accent; info-chips blijven rustig (neutraal grijs of zacht groen).
  Let op: een opacity-modifier op een arbitrary CSS-var (bv.
  `bg-[var(--btn-pay-bg)]/10`) rendert onbetrouwbaar — gebruik
  `focus:ring-brand` of de arbitrary-property-vorm
  `[border-color:var(--btn-pay-bg)]`.
- **Tooltips** die binnen een `overflow`-container zouden worden afgekapt:
  render ze via een portal (zie `ProjectLabel` in de marketplace) zodat ze
  vrij zweven.
- **Schaalregel-voorbeeld:** filter op project toont chips bij ≤5 projecten
  en schakelt automatisch over op een compacte dropdown bij meer.

## Context: de Marketplace & projecten

- **Bulk "Blog links"-flow** op `/dashboard/marketplace` in 3 stappen:
  **Selecteren → Invullen → Bevestigen**. Bulkbestellingen gaan **op
  rekening** (verzamelfactuur per maand, geen betaling op het moment zelf).
- **Bevestigen** is de laatste check: per plaatsing wat er geplaatst wordt
  (bij een blog de titel, bij een link de ankertekst → URL), wie de inhoud
  maakt ("Wij schrijven" vs. zelf), wanneer het live gaat, en het project.
  Links kolom = kaarten, rechts een vaste samenvatting met het totaal.
- **Project** = de agency-klant/campagne, een **label per regel**
  (`OrderItem.projectId`, optioneel). De order zelf hangt aan het verzamel-
  project "Bestellingen" — dus filteren/tellen op projecten gaat op
  **regel-niveau**, niet op order-niveau.
- **Projecten** aanmaken/koppelen kan op de Projecten-pagina én direct in de
  bewerk-popup. **Mijn orders** kent een project-filter met per-project
  totaal; een project is door te klikken naar `/dashboard/projects/[id]` met
  al z'n plaatsingen, status en totaal.
