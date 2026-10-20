# Planning & backlog

Levende lijst van wat er nog te doen is. Geen urgentie-dwang — we pakken op
wat jij kiest. Afgeronde punten mogen hieruit (of naar "Gedaan").

## Toekomst / groot

- [ ] **Domein overzetten naar `publito.nl`.** Het platform draait nu op
  `(mijn.)nugevonden.nl`; de merknaam is al Publito (logo via Admin →
  Instellingen). Later overzetten. Raakt o.a.:
  - Custom domein + SSL in Railway (domein toevoegen, DNS instellen).
  - `NEXTAUTH_URL` / basis-URL en eventuele absolute links in e-mails.
  - Afzender-/reply-adres van mails en verwijzingen naar de oude domeinnaam.
  - Resterende hardcoded "Nugevonden"-teksten vervangen door Publito.
  - Redirect van het oude domein naar het nieuwe.
  > We werken dit uit op het moment dat we het doen; nu alleen genoteerd.

## Verfijningen (klein, optioneel)

- [ ] **Dashboard-home balk** "Je hebt een bestelling in bewerking" — besluiten:
  weg, laten, of anders verwoorden.
- [ ] **"Aanmaken"-knop** op de Projecten-pagina staat nog blauw i.p.v. de
  groene huisstijl.
- [ ] **Facturen-pagina** verrijken zoals de mockup: stat-tegels
  (Openstaand / Betaald), de zand "op rekening"-melding en nettere
  status-chips. (De echte pagina werkt al, maar is kaal.)
- [ ] **Project-overzichtskaarten** bovenaan Mijn orders (de rij kaartjes uit
  de filter-mockup) — nu alleen de filter zelf gebouwd.
- [ ] **"Live op"-chips** op Bevestigen eventueel uniforme lengte geven.

## Ideeën / later te bespreken

- [ ] **Uptime-/downtime-monitor voor alle sites.** Periodiek controleren of
  de (publisher-)sites bereikbaar zijn, met een melding bij downtime. Eventueel
  te combineren met "Links na plaatsing automatisch controleren" (link-health)
  uit de Nice-to-have-lijst. → hoort ook thuis op Admin → Nice to have.
- [ ] Orders/plaatsingen filteren of sorteren binnen een projectdetail.
- [ ] Bedrag per project ook in de orderregel zichtbaar maken bij een
  actief projectfilter (nu toont de regel het hele-order-bedrag).

## Gedaan (recent)

- Bevestigen-stap herontworpen (regel-kaarten, details, "wie schrijft",
  twee kolommen met vaste samenvatting).
- Project overal koppelbaar (ook in de bewerk-popup), met uitleg-tooltip.
- Mijn orders: filter op project + per-project totaal; schaalt (chips ≤5,
  dropdown >5).
- Projectdetail-pagina met plaatsingen, status en totaal; klikbare
  Projecten-kaarten.
- `PRODUCT.md` (product- & ontwerpkompas) toegevoegd.
