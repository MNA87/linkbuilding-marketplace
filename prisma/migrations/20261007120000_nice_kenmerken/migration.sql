-- Planning, Nice to have (7-10-2026): quality labels in the Marketplace
-- (for when there are some 25-30 sites), offers, and placement rules per site.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "note", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, t.title, t.note,
       'todo', COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + t.n
FROM (VALUES
  (1, 'Kenmerken in de Marketplace: Snel online, Nieuw, Aanrader',
   'Pas zinvol vanaf zo''n 25-30 sites of als er publishers van buiten komen. Een kolom "Kenmerken" (aan/uit via Kolommen) met labels in woorden, alleen als het klopt, geen grijze lege icoontjes: ⚡ Snel online (de laatste 3 maanden gemiddeld binnen 24 uur geplaatst, uit echte cijfers), Nieuw (laatste 30 dagen toegevoegd) en ★ Aanrader (zet je zelf per site aan, spaarzaam). Filter met vinkjes onder de kolom; op telefoon de labels op de kaart. Later met publishers: Aanrader voor betrouwbare publishers.'),
  (2, 'Aanbiedingen: tijdelijk lagere prijs per site',
   'Een site tijdelijk in de aanbieding zetten, bijvoorbeeld een site die weinig bestellingen krijgt: de oude prijs doorgestreept met de nieuwe ernaast, een einddatum, en een snelfilter "Aanbiedingen". Spaarzaam gebruiken, anders zegt het niets meer (bij de concurrent staat bijna alles in de aanbieding).'),
  (3, 'Plaatsingsregels per site',
   'Per site vastleggen waar een klant op moet letten, bijv. "geen link in de inleiding", "maximaal 2 links", "geen casino". De klant ziet het bij de details van de site en in het bestelformulier, niet in elke regel van de tabel. Voorkomt gedoe achteraf.')
) AS t(n, title, note)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = t.title);
