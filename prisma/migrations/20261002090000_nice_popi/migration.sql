-- Ideas from Popi's MCP announcement (2-10-2026), see docs/nice-to-have/ai-koppeling.md.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, t.title,
       'todo', COALESCE((SELECT MAX("position") FROM "LaunchItem" WHERE "list" = 'nice'), -1) + t.n
FROM (VALUES
  (1, 'Passende sites zoeken bij een URL'),
  (2, 'Ankertekst-advies'),
  (3, 'Nieuwsbrief naar klanten')
) AS t(n, title)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = t.title);
