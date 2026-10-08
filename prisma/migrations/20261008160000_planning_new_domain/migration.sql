-- Planning (8-10-2026): what to do once the new domain is there, so every
-- mail goes out from it.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position", "note")
SELECT gen_random_uuid()::text, 'livegang', 0, 'Mail vanaf het nieuwe domein', 'todo',
  (SELECT coalesce(max("position"), 0) + 1 FROM "LaunchItem" WHERE "list" = 'livegang'),
  E'Zodra het nieuwe domein er is, gaan alle mails (previews, facturen, meldingen en antwoorden) daarvandaan:\n1. Bij Resend het nieuwe domein toevoegen en de DNS-regels die Resend geeft bij het domeinbeheer invullen.\n2. Bij Railway het afzenderadres (EMAIL_FROM) op het nieuwe domein zetten.\n3. Een ordermailbox op het nieuwe domein aanmaken (bijv. orders@) en die invullen bij Admin → Instellingen → Koppelingen, en het adres toevoegen bij Eigen adressen.\nAan de code hoeft niets te veranderen.'
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "title" = 'Mail vanaf het nieuwe domein');
