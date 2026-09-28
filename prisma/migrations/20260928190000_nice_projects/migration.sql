-- Projecten is out of the customer menu until it's worked out properly.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position")
SELECT gen_random_uuid()::text, 'nice', 0, 'Projecten goed uitwerken', 'todo',
       COALESCE((SELECT MAX("position") + 1 FROM "LaunchItem" WHERE "list" = 'nice'), 0)
WHERE NOT EXISTS (SELECT 1 FROM "LaunchItem" WHERE "list" = 'nice' AND "title" = 'Projecten goed uitwerken');
