# Planning & backlog

Levende lijst van wat er nog te doen is. Geen urgentie-dwang — we pakken op
wat jij kiest. Afgeronde punten mogen hieruit (of naar "Gedaan").

> Dit is de **ontwerp-/dev-backlog**. De **livegang-, beveiligings- en
> Nice-to-have-lijst** leven in **Admin → Livegang** (de bron van waarheid);
> die dupliceren we hier bewust niet. Zie ook `docs/beveiliging.md`.

## Toekomst / groot

- [ ] **`www.publito.nl` doorsturen naar `publito.nl` + mail @publito.nl.**
  Keuze eigenaar: DNS blijft bij TransIP (ALIAS @ en CNAME mijn → Railway;
  SiteGround-DNS kan geen ALIAS op het hoofddomein). Mail en de www-redirect
  draaien bij SiteGround (IP 34.1.230.193): in TransIP `www` A en de
  mailregels (MX mailspamprotection, SPF, DKIM, DMARC, mail/autodiscover/
  autoconfig A) naar SiteGround; in SiteGround Site Tools een 301 van
  publito.nl naar https://publito.nl en een Let's Encrypt-certificaat voor
  www. Werkt alleen zolang de SiteGround-site blijft bestaan. Lukt het
  certificaat niet: TransIP Doorstuurservice (€ 6,99 p.j., alléén www-regels
  met de hand, "TransIP instellingen" uit) of Cloudflare (gratis) als DNS.
  Railway Hobby staat maar 2 eigen domeinen per service toe.

- [ ] **Platformmail via Resend vanaf `publito.nl`.** Domein publito.nl
  toevoegen in Resend (regio EU), de DNS-regels die Resend geeft
  (`resend._domainkey` TXT, `send` MX + TXT) bij TransIP zetten — die
  botsen niet met de SiteGround-mailregels op @ — en na "Verified" in
  Railway `EMAIL_FROM="Publito <no-reply@publito.nl>"` zetten. De
  standaardwaarde in de code is al Publito.

- [ ] **Domein overzetten naar `publito.nl`.** Het platform draait nu op
  `(mijn.)nugevonden.nl`; de merknaam is al Publito (logo via Admin →
  Instellingen). Later overzetten. Raakt o.a.:
  - Custom domein + SSL in Railway (domein toevoegen, DNS instellen).
  - `NEXTAUTH_URL` / basis-URL en eventuele absolute links in e-mails.
  - Afzender-/reply-adres van mails en verwijzingen naar de oude domeinnaam.
  - Resterende hardcoded "Nugevonden"-teksten vervangen door Publito.
  - Redirect van het oude domein naar het nieuwe.
  > We werken dit uit op het moment dat we het doen; nu alleen genoteerd.

- [ ] **Onboarding nieuwe klanten via KVK-koppeling.** Bedrijven snel laten
  aanmelden met echte gegevens (KVK Zoeken API, flow per land NL/BE/EU/
  buiten-EU), zonder dure ingekochte lijst. Opzet staat in
  **`docs/bedrijf-aanmelden-kvk.md`**; de volledige overdracht (incl.
  screenshots, mockup en testscript) in repo `MNA87/solvari-leads`,
  `docs/kvk-aanmelden/`. *Later mee aan de slag.*

## Verfijningen (klein, optioneel)

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
- [ ] **"Winkelmandje vergeten"-reminder-mail (abandoned cart).** Als een klant
  plaatsingen in het mandje heeft (order status `NEW`) maar na X tijd niet heeft
  afgerekend: een nudge-mail om de bestelling af te ronden. De e-mail-tegenhanger
  van de dashboard-winkelmandje-banner die we al hebben. Opzet (uit een mockup):
  aantal-bewuste onderwerpregel ("Je hebt nog N plaatsing(en) in je winkelmand"),
  persoonlijke aanhef, **mandje-samenvatting** per site (domein + DR/niche/verkeer
  + prijs) met totaal (excl. btw), een duidelijke **"Bestelling afronden →"**-knop,
  secundair "pas je selectie aan", en een **persoonlijk "zal ik meekijken?"-blok**
  (reply-op-deze-mail). Let op: niet te vaak sturen (1×, evt. 1 herinnering) en
  respecteer afmelding. → hoort ook thuis op Admin → Nice to have.

## Gedaan (recent)

- **CMS stap 2: Blog en Media (Admin → Publieke site).** Blogberichten met een
  blok-editor (alinea, tussenkop H2/H3, afbeelding, lijst, citaat, knop; "/"
  op een lege regel opent het blokmenu; **vet**, *cursief* en [links](…)),
  paneel met status/publicatiedatum (inplannen), adres, auteur, samenvatting,
  categorieën (aanmaken/verwijderen), uitgelichte afbeelding en SEO met
  lengtemeters en Google-voorbeeld. Autosave als concept; een gepubliceerd
  bericht houdt zijn live versie tot "Bijwerken". Offline halen, verwijderen,
  voorbeeld voor admins (`?cms=preview`). **Media**bibliotheek met upload
  (PNG/JPG/WEBP/GIF, max 8 MB, automatisch verkleind naar WebP ≤1800px),
  alt-tekst, gebruikscontrole en verwijderen; opslag in de uploads-bucket of
  (zonder bucket) in de database; publiek via `/api/media/<id>`.
  Publiek: `/blog` (kop bewerkbaar als CMS-pagina, categoriefilter, kaarten)
  en `/blog/<slug>` (artikel, "Lees ook", BlogPosting JSON-LD, Open Graph);
  Blog-link in nav en footer. *Volgende stap (3):* menu/footer beheren en
  nieuwe pagina's uit blokken samenstellen.

- **CMS voor de publieke site (stap 1): Admin → Publieke site.** Menu-groep met
  **Pagina's** (overzicht met status, SEO-stip, concept-melding, offline/online)
  en **Site-instellingen** (cijfers, contactgegevens, prijskaarten; tokens als
  `{sites}` worden overal ingevuld). Editor met live voorbeeld in een iframe
  (`?cms=preview`, alleen admins, toont het concept), klikken op een blok in
  het voorbeeld opent de velden, blokken verbergen/verplaatsen, SEO-paneel met
  lengtemeters en Google-voorbeeld, automatisch opslaan als concept, **Bijwerken**
  zet live, concept weggooien, ongedaan maken, desktop/mobiel. Standaardteksten
  in code (`src/lib/cms/pages.ts`); de DB bewaart alleen afwijkingen, dus
  wijzigingen via de chat blijven werken (zie CLAUDE.md). Framing is alleen op
  de voorbeeld-URL en alleen same-origin toegestaan (`next.config.js`).
  *Volgende stappen:* blog + media (stap 2), menu/footer en nieuwe pagina's
  met blokken (stap 3).

- **Publieke site (publito.nl) gebouwd** in route-group `src/app/(public)/`:
  homepage (`/`, kop "Google vindt je. AI noemt je."), `/prijzen`,
  `/uitbesteden`, `/over-ons`, `/contact` (formulier → mail naar admins, met
  rate-limit en honeypot), plus `/privacy` en `/voorwaarden` verhuisd naar
  dezelfde shell. Eigen nav/footer, zelf-gehoste Inter, Publito-logokleuren
  (`pub.*` in Tailwind). Ingelogde bezoekers op `/` gaan nog steeds door naar
  hun eigen omgeving. Huisstijl na mockup-rondes: lichtgrijze secties, titels
  in warm antraciet (`pub.ink`), groen alleen als accent, zandkleurige footer
  met witte afsluitband (groene streep links) en duidelijke kolomkoppen.
  Mobiel: hamburgermenu, geen cookiebanner; alle schermafbeeldingen (hero
  en de drie stappen) hebben een telefoon-, tablet- en desktopversie in
  `src/app/(public)/_assets/` en de pagina toont de versie die bij het
  schermformaat past (opnieuw maken: scratchpad-scripts `shoot-market.js`
  en `shoot-steps.js` tegen een lokale server).
  **Nog te doen door eigenaar:** echte cijfers en
  contactgegevens invullen in `src/lib/publicSite.ts` (nu placeholders:
  500+ sites, 20.000+ plaatsingen, € 35 / € 67, info@publito.nl).

- **Dashboard- en orders-vormgeving aangescherpt (action-first, rustiger
  kleurgebruik).**
  - *Koop-balken ("Nieuwe links plaatsen").* Geen aparte kop meer; **Blog
    links** / **Homepage links** staan als grijze eyebrow-kop bóven hun eigen
    balk. In de balk een **zacht slate aantal-paneel** (sites) dat opvalt
    zonder met de groene actie te botsen, **"Vanaf €X"** zonder periode (die
    verschilt per site: Per jaar vs Permanent) en een korte omschrijving per
    type.
  - *Winkelmandje-herinnering op het dashboard.* Gele banner (amber, zoals
    "wacht op jouw inhoud") die verschijnt zodra er een niet-afgerekende order
    is (`orderItem`-telling op status `NEW`), met "X plaatsing(en) in je
    winkelmandje" en een knop naar `/dashboard/marketplace`. Op desktop
    compact (~helft lager), uitgelijnd met de koop-balken.
  - *Mijn orders rustiger.* De aparte **"Filters"-knop** (soort + sorteren)
    is weg — zoeken + status-tabs (+ project voor bureaus) dekken de behoefte;
    de lijst blijft nieuwste-eerst. Dode componenten `OrdersFilters.tsx` en
    `OrdersToolbar.tsx` verwijderd.
  - *Order-detail.* De "wacht op jouw inhoud"-melding somt niet langer alle
    sitenamen op (werd rommelig bij veel links); elke link heeft nu een
    subtiel grijs **indexnummer**.
  - *Kleur-hiërarchie.* De actie die op de klant wacht (**"Lever aan"** /
    **"Nu invullen"**) is nu **oranje** (`#ea580c`) i.p.v. groen — matcht de
    amber status en onderscheidt zich van de groene CTA's (Bekijk aanbod, Naar
    winkelmandje). Minder massief groen op de pagina.
- **Dashboard rustiger + Mijn orders netter met archiveren.** De twee losse
  gele balken op het dashboard zijn één nette **"Te doen"-strook** geworden
  (betaalde links wachten op inhoud, bestelling in bewerking, nieuwe reacties,
  links die verlopen) — per punt één rij met een gekleurd icoontje en een knop;
  leeg → de strook verdwijnt. De statrij (Actief / Ingepland / In mandje) staat
  nu bovenaan i.p.v. onderaan weggestopt. Bij **Mijn orders** kun je een order
  **archiveren**: hij valt uit de standaardlijst en staat onder de chip
  **Gearchiveerd** (met teller), terugzetten kan altijd. Nieuw veld
  `Order.customerArchivedAt` — losgekoppeld van de admin-archivering
  (`Order.archivedAt`), zodat de twee elkaar niet raken.
- **Afbeelding kiezen netter en consistent.** Eén gedeelde component
  (`ArticleImageField`) voor zowel het reguliere invulscherm als het
  bulk-popup: tabs **Afbeelding zoeken** (Pixabay) / **Eigen afbeelding**, een
  grote rustige preview met Vervangen/Verwijderen, en **max 2 MB** met een
  directe client-check. Zoekknop toont alleen "Zoeken" (zonder vergrootglas).
  De gekozen aanlever-kaart bij "Hoe lever je aan?" licht nu zacht-groen op
  (`--pay-soft` i.p.v. een opacity op een CSS-var, die in Tailwind v3 niet
  rendert — zie PRODUCT.md).
- **Opslag besparen: lokale kopie van de uitgelichte afbeelding opruimen ná
  publicatie.** De foto staat na plaatsing in de mediabibliotheek van de
  doelsite, dus de kopie in onze bucket is overbodig. Een geplande taak ruimt
  die een dag ná publicatie op (nooit eerder — de WordPress-plugin haalt de
  foto pas óp ná de plaatsingsbevestiging). Nieuw veld
  `OrderItem.articleImagePurged`; de sleutel blijft staan (de plugin vergelijkt
  'm bij wijzigingen), alleen de bytes gaan weg.
- **Deploys fors sneller.** Slank, zelfstandig productie-image via een
  multi-stage Dockerfile (Next `output: "standalone"` — alleen de echt
  gebruikte bestanden i.p.v. de volledige `node_modules`), TS/ESLint uit de
  productie-build (draaien we zelf vóór elke push) en een healthcheck op
  `/api/health`. Deploytijd van ~6 min naar ~1,5–2,5 min.
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
