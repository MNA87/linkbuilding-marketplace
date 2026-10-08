-- Planning (8-10-2026): to decide together how mail is handled, before
-- building replies and an invoice address per customer.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'livegang', 0, 'Aanpak mails: ontvangen, beantwoorden en facturen', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'livegang'),
  E'Samen bepalen hoe we omgaan met de mails die binnenkomen, voordat we verder bouwen:\n- Welke mailbox(en) bestellingen ontvangen, en automatisch of met de hand doorsturen.\n- Beantwoorden vanuit Binnengekomen (via Resend, in hetzelfde mailgesprek).\n- Een eigen e-mailadres voor facturen per klant (bijv. de administratie van Traffic Today) voor de verzamelfactuur en herinneringen; de klant kan het ook zelf invullen bij Account.\n- Klanten die via het platform bestellen en klanten die per mail bestellen: wat krijgt wie, en van welk adres.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Aanpak mails: ontvangen, beantwoorden en facturen');
