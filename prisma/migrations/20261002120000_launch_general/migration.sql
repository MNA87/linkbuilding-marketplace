-- Livegang gets a third list, "algemeen": your own to-dos apart from the
-- platform. Plus two points for before the launch.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, t.list, t.step, t.title, 'todo',
       COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = t.list AND "step" = t.step), -1) + t.n
FROM (VALUES
  ('algemeen', 0, 1, 'Jufjanneke.nl verder inrichten'),
  ('algemeen', 0, 2, 'Gesprek Arlina: 10 tot 20 uur per maand, €15 per uur'),
  ('algemeen', 0, 3, 'Youri: duidelijke afspraak of creditfactuur, vóór eind 2026'),
  ('livegang', 3, 1, 'Overige domeinen koppelen'),
  ('livegang', 3, 2, 'Bestellingen per mail binnenhalen')
) AS t(list, step, n, title)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = t.list AND "title" = t.title);
