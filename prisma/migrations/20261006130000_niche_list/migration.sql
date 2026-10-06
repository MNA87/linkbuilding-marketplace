-- The niche list (Stamdata → Categorieën): one short, well-known word each.
-- Existing niches stay, with their sites; two are renamed to the name in
-- this list so it's one list.
UPDATE "Category" SET "name" = 'Auto'
WHERE "name" = 'Automotive' AND NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Auto');
UPDATE "Category" SET "name" = 'Financiën'
WHERE "name" = 'Financieel' AND NOT EXISTS (SELECT 1 FROM "Category" WHERE "name" = 'Financiën');

INSERT INTO "Category" ("id", "name") VALUES
  ('cat_' || md5('Auto'), 'Auto'),
  ('cat_' || md5('Beauty'), 'Beauty'),
  ('cat_' || md5('Bouw'), 'Bouw'),
  ('cat_' || md5('Cadeaus'), 'Cadeaus'),
  ('cat_' || md5('Cultuur'), 'Cultuur'),
  ('cat_' || md5('Dieren'), 'Dieren'),
  ('cat_' || md5('DIY'), 'DIY'),
  ('cat_' || md5('Duurzaamheid'), 'Duurzaamheid'),
  ('cat_' || md5('E-commerce'), 'E-commerce'),
  ('cat_' || md5('Elektronica'), 'Elektronica'),
  ('cat_' || md5('Energie'), 'Energie'),
  ('cat_' || md5('Entertainment'), 'Entertainment'),
  ('cat_' || md5('Evenementen'), 'Evenementen'),
  ('cat_' || md5('Familie'), 'Familie'),
  ('cat_' || md5('Fietsen'), 'Fietsen'),
  ('cat_' || md5('Financiën'), 'Financiën'),
  ('cat_' || md5('Fotografie'), 'Fotografie'),
  ('cat_' || md5('Gaming'), 'Gaming'),
  ('cat_' || md5('Gezondheid'), 'Gezondheid'),
  ('cat_' || md5('Huwelijk'), 'Huwelijk'),
  ('cat_' || md5('Juridisch'), 'Juridisch'),
  ('cat_' || md5('Lifestyle'), 'Lifestyle'),
  ('cat_' || md5('Marketing'), 'Marketing'),
  ('cat_' || md5('Mode'), 'Mode'),
  ('cat_' || md5('Nieuws'), 'Nieuws'),
  ('cat_' || md5('Onderwijs'), 'Onderwijs'),
  ('cat_' || md5('Regionaal'), 'Regionaal'),
  ('cat_' || md5('Reizen'), 'Reizen'),
  ('cat_' || md5('Senioren'), 'Senioren'),
  ('cat_' || md5('Software'), 'Software'),
  ('cat_' || md5('Speelgoed'), 'Speelgoed'),
  ('cat_' || md5('Sport'), 'Sport'),
  ('cat_' || md5('Technologie'), 'Technologie'),
  ('cat_' || md5('Tuin'), 'Tuin'),
  ('cat_' || md5('Vastgoed'), 'Vastgoed'),
  ('cat_' || md5('Voeding'), 'Voeding'),
  ('cat_' || md5('Werk'), 'Werk'),
  ('cat_' || md5('Wonen'), 'Wonen'),
  ('cat_' || md5('Zakelijk'), 'Zakelijk')
ON CONFLICT ("name") DO NOTHING;
