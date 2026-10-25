# Planning & backlog

Levende lijst van wat er nog te doen is. Geen urgentie-dwang — we pakken op
wat jij kiest. Afgeronde punten mogen hieruit (of naar "Gedaan").

> Dit is de **ontwerp-/dev-backlog**. De **livegang-, beveiligings- en
> Nice-to-have-lijst** leven in **Admin → Livegang** (de bron van waarheid);
> die dupliceren we hier bewust niet. Zie ook `docs/beveiliging.md`.

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

- [ ] **Inlogproblemen monitoren (nice-to-have).** Zodat een klant die niet
  kan inloggen niet onopgemerkt blijft. Twee blinde vlekken, elk apart nodig:
  (A) **serverkant** — inlogpogingen loggen met uitkomst (gelukt / fout
  wachtwoord / geblokkeerd / e-mail niet bevestigd / 2FA) + browser, zichtbaar
  in Admin, zodat patronen opvallen; (B) **clientkant** — piepklein ouderwets
  beacon-scriptje dat JS-fouten + browserversie meldt, want als de app niet
  draait (zoals op Safari 16, okt 2026) komt er serverkant géén verzoek binnen.
  Optioneel: "Lukt inloggen niet?"-knop (mailto, werkt zonder JS) + alert bij
  een piek. → hoort ook thuis op Admin → Nice to have.
- [ ] **Uptime-/downtime-monitor voor alle sites.** Periodiek controleren of
  de (publisher-)sites bereikbaar zijn, met een melding bij downtime. Eventueel
  te combineren met "Links na plaatsing automatisch controleren" (link-health)
  uit de Nice-to-have-lijst. → hoort ook thuis op Admin → Nice to have.
- [ ] **Bankoverschrijving als betaalmethode** (geparkeerd tot livegang).
  Kan met een webhook: de klant krijgt een IBAN, de order komt op "wacht op
  betaling" en wordt pas afgehandeld zodra het geld binnen is
  (`checkout.session.async_payment_succeeded`). Vraagt een klant-object aan de
  checkout-sessie + een tussenstatus. In de sandbox is `customer_balance`
  onbetrouwbaar te testen; daarom pas bij livegang afmaken en live testen.
  (PayPal werkt nu wél, sinds de Connect-`transfer_group` alleen nog wordt
  gezet als publisher-uitbetalingen aanstaan.)
- [ ] Orders/plaatsingen filteren of sorteren binnen een projectdetail.
- [ ] Bedrag per project ook in de orderregel zichtbaar maken bij een
  actief projectfilter (nu toont de regel het hele-order-bedrag).

## Gedaan (recent)

- **Kortingen zichtbaar gemaakt** (percentage of afgesproken vaste prijs):
  rustige melding bovenin de marktplaats, de doorgestreepte "van"-prijs bij
  Invullen en Bevestigen, een kortingsregel in de samenvatting ("Je bespaart
  €X") én op de factuur. Per-site op basis van het echte prijsverschil, dus
  automatisch goed zodra er later externe sites (zonder korting) bij komen.
  Nieuw veld `OrderItem.listPriceSnap` legt de standaardprijs vast bij het
  bestellen.
- **Reguliere klant rekent direct af via Stripe** (iDEAL, kaart, Apple Pay,
  Link, PayPal); dezelfde bulk-flow voor iedereen, alleen het afrekenen
  verschilt (bureau op rekening). Stripe-webhook weer werkend; bedragen bij
  Bevestigen altijd op 2 decimalen (centen-afronding, net als de factuur).
- **"Nu invullen" bij een betaald "later"-item**: opent meteen op "Zelf
  aanleveren / Tekst typen" met de Google Doc-optie zichtbaar — dezelfde
  keuzes als bij een reguliere of bulk-aanvraag. Order-velden (website,
  onderwerp, periode, wie-schrijft) blijven vergrendeld; alleen de inhoud
  is te bewerken.
- Bevestigen-stap herontworpen (regel-kaarten, details, "wie schrijft",
  twee kolommen met vaste samenvatting).
- Project overal koppelbaar (ook in de bewerk-popup), met uitleg-tooltip.
- Mijn orders: filter op project + per-project totaal; schaalt (chips ≤5,
  dropdown >5).
- Projectdetail-pagina met plaatsingen, status en totaal; klikbare
  Projecten-kaarten.
- `PRODUCT.md` (product- & ontwerpkompas) toegevoegd.
