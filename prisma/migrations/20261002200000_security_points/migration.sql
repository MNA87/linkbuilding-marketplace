-- Points from the security check of 2-10-2026 (docs/beveiliging.md), under
-- Livegang step 4 "Veiligheid en controle", plus two smaller ones as nice to have.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, t.list, t.step, t.title, 'todo',
       COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = t.list AND "step" = t.step), -1) + t.n
FROM (VALUES
  ('livegang', 4, 1, 'Tweestapsverificatie aan op Railway, GitHub, SiteGround en mail'),
  ('livegang', 4, 2, 'Admin-wachtwoord lang en uniek'),
  ('livegang', 4, 3, 'Admin-inlog korter geldig (1 dag)'),
  ('livegang', 4, 4, 'Account op slot na 10 foute inlogpogingen'),
  ('livegang', 4, 5, 'Mail bij inloggen als admin'),
  ('livegang', 4, 6, 'Geheime sleutel WP-plugin niet meer in de URL'),
  ('nice', 0, 1, 'Registratie verklapt niet of e-mailadres al bestaat'),
  ('nice', 0, 2, 'Opmaak in artikelen strenger filteren')
) AS t(list, step, n, title)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = t.list AND "title" = t.title);
