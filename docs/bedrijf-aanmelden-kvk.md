# Bedrijven aanmelden met KVK-koppeling

**Doel:** bedrijven snel laten aanmelden met echte gegevens, zonder dure data
en zonder dat de site misbruikt kan worden om gegevens op te halen.

> Status: **ontwerp/plan** (nog niet gebouwd). Mockup "Bedrijf Aanmelden Flow",
> huidige versie — screenshots `1-zoeken-autocomplete.png` t/m
> `5-engels-buiten-eu.png`.
>
> **Bron van waarheid:** de volledige overdracht (README + screenshots +
> klikbare mockup + testscript) staat in repo **`MNA87/solvari-leads`**,
> map `docs/kvk-aanmelden/`. Dit bestand is de kopie voor Publito, omdat we
> dezelfde flow willen gebruiken voor **onboarding van nieuwe klanten**.

## Besluiten
- **KVK Zoeken API**, abonnement **€6,20/maand**. Zoeken is gratis; het betaalde
  profiel (€0,02) gebruiken we **niet**, dus **€0 per aanmelding**.
- **Geen ingekochte bedrijvenlijst.** (Trustoo vult e-mail/telefoon vooraf in uit
  een oud, ingekocht bestand: verouderd, AVG-gevoelig, lekt gegevens — niet doen.)
- **Simpele layout:** één kaart, alles onder elkaar (zoals
  `marketplace.digitalrise.nl`, maar met eigen kleuren en lettertype). **Geen
  e-mailcode.**
- **Tweetalig** (NL/EN) met een NL/EN-knop bovenaan de kaart; de gekozen taal
  wordt onthouden.
- **Land** is een gewone landenlijst: **Nederland en België bovenaan**, dan alle
  27 EU-landen, dan overige (VK, Zwitserland, Noorwegen, VS enz.) en "Ander
  land". Het formulier past zich aan het gekozen land aan.

## Flow per land

| Land | Bedrijf vinden | Controle |
|------|----------------|----------|
| **Nederland** | Autocomplete op naam of KVK-nummer via **KVK Zoeken** (naam, KVK-nr, straat, plaats) | Postcode + huisnummer: **tweede gratis zoekopdracht** (`?postcode=…&huisnummer=…`) geeft het volledige adres en moet bij het KVK-nummer horen |
| **België** | **KBO Open Data** (gratis download, maandelijks bijwerken) in eigen database; zelfde autocomplete | Postcode + huisnummer tegen eigen database |
| **Andere EU-landen** | **BTW-nummer via VIES** (gratis). Vaak komen naam en adres mee; bij Duitsland en Spanje niet → zelf invullen | BTW-nummer geldig volgens VIES (Griekenland = code **EL**) |
| **Buiten de EU** | Handmatig: naam, registratienummer, website | **Handmatige goedkeuring** |

**Altijd mogelijk:** "Staat je bedrijf er niet bij? Vul het zelf in."

Daarna: voornaam, achternaam, e-mail, telefoon (met autocomplete zodat de
browser invult), wachtwoord, akkoord voorwaarden → **Account aanmaken**. Opslaan
in eigen database met **KVK-/ondernemings-/BTW-nummer als sleutel**.

## Wat de KVK-testomgeving teruggaf
- **Zoeken op KVK-nummer of naam:** `kvkNummer`, `vestigingsnummer`, `naam`,
  `type`, `adres.binnenlandsAdres.{straatnaam, plaats}`. **Geen postcode/huisnummer.**
- **Zoeken op postcode + huisnummer:** wél `huisnummer`, `huisletter`, `postcode`.
- **Test-key (publiek; KVK-testomgeving, alleen fictieve bedrijven):**
  `l7xx1f2691f2520d487b902f4e0b57a0b197`
  basis-URL `https://api.kvk.nl/test/api/v2/zoeken`.
- **Testbedrijf:** `68750110`, Test BV Donald, Hizzaarderlaan 3A, 8823SJ Lollum.
- **KVK geeft nooit telefoon of e-mail.**

## Beveiliging
- **API-key alleen op de server** (Railway-variabele `KVK_API_KEY`), **nooit in
  de browser** (de productie-key komt niet in de repo).
- Serverroute bijv. **`/api/bedrijf/zoek`**, limiet **20 zoekacties per uur per
  IP**, **Cloudflare Turnstile** tegen bots.
- In de lijst **alleen naam, plaats en nummer** tonen.
- Antwoorden een tijdje bewaren; **aanmelding pas live na korte controle**.

## Nog te doen
- [ ] Eigenaar vraagt API-key aan op **developers.kvk.nl** (Zoeken API) en zet die
  in Railway (`KVK_API_KEY`).
- [ ] **Serverroute + aanmeldpagina** bouwen (NL + EN), testen met de test-key en
  `?proef=ja`, proeflink geven.
- [ ] **KBO Open Data** registreren, importeren, maandelijkse update.
- [ ] **VIES-check** toevoegen.
- [ ] Alleen live zetten als de eigenaar dat zegt.
