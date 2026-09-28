-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "launchDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LaunchItem" (
    "id" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LaunchItem_list_step_position_idx" ON "LaunchItem"("list", "step", "position");

-- The points as they stood when the page was made.
INSERT INTO "LaunchItem" ("id", "list", "step", "title", "status", "position") VALUES
  (gen_random_uuid()::text, 'livegang', 1, 'Voorwaarden en privacy', 'todo', 0),
  (gen_random_uuid()::text, 'livegang', 1, 'Bedrijfsgegevens compleet', 'todo', 1),
  (gen_random_uuid()::text, 'livegang', 1, 'Akkoord voorwaarden vastleggen', 'todo', 2),
  (gen_random_uuid()::text, 'livegang', 2, 'Stripe live zetten', 'todo', 3),
  (gen_random_uuid()::text, 'livegang', 2, 'E-maildomein bij Resend', 'todo', 4),
  (gen_random_uuid()::text, 'livegang', 2, 'Mails en inlogscherm in één stijl', 'busy', 5),
  (gen_random_uuid()::text, 'livegang', 3, 'Testdata opruimen', 'todo', 6),
  (gen_random_uuid()::text, 'livegang', 3, 'WordPress-plugin op eigen sites', 'todo', 7),
  (gen_random_uuid()::text, 'livegang', 4, 'Tweestapsverificatie voor admin', 'todo', 8),
  (gen_random_uuid()::text, 'livegang', 4, 'Sentry controleren', 'todo', 9),
  (gen_random_uuid()::text, 'livegang', 4, 'Back-up terugzetten testen', 'todo', 10),
  (gen_random_uuid()::text, 'nice', 0, 'Nu betalen, later aanleveren', 'done', 0),
  (gen_random_uuid()::text, 'nice', 0, 'Mail bij verlaten winkelmandje', 'todo', 1),
  (gen_random_uuid()::text, 'nice', 0, 'Automatisch verlengen', 'todo', 2),
  (gen_random_uuid()::text, 'nice', 0, 'Favorieten', 'todo', 3),
  (gen_random_uuid()::text, 'nice', 0, 'WordPress "Gepland"', 'todo', 4),
  (gen_random_uuid()::text, 'nice', 0, 'Drip feed', 'todo', 5),
  (gen_random_uuid()::text, 'nice', 0, 'Standaard rubrieken', 'todo', 6),
  (gen_random_uuid()::text, 'nice', 0, 'URL-voorbeeld', 'todo', 7),
  (gen_random_uuid()::text, 'nice', 0, 'Afbeeldingen en YouTube in de editor', 'todo', 8),
  (gen_random_uuid()::text, 'nice', 0, 'Eigen afbeelding uploaden', 'todo', 9),
  (gen_random_uuid()::text, 'nice', 0, 'AI in de taal van de site', 'todo', 10),
  (gen_random_uuid()::text, 'nice', 0, 'Voorbeeld-URL per site', 'todo', 11),
  (gen_random_uuid()::text, 'nice', 0, 'Verkeer over 6 maanden', 'todo', 12),
  (gen_random_uuid()::text, 'nice', 0, 'Labels Nieuw en Populair terug', 'todo', 13),
  (gen_random_uuid()::text, 'nice', 0, 'AI-Cited', 'todo', 14),
  (gen_random_uuid()::text, 'nice', 0, 'Google Analytics voor publishers', 'todo', 15),
  (gen_random_uuid()::text, 'nice', 0, 'Mail bij nieuw bericht', 'todo', 16),
  (gen_random_uuid()::text, 'nice', 0, 'Sessiebeveiliging', 'busy', 17),
  (gen_random_uuid()::text, 'nice', 0, 'Meerdere talen (Engels)', 'todo', 18),
  (gen_random_uuid()::text, 'nice', 0, 'API voor klanten', 'todo', 19),
  (gen_random_uuid()::text, 'nice', 0, 'Iconen op het orderdetail', 'todo', 20),
  (gen_random_uuid()::text, 'nice', 0, 'Regelmatige systeemupdate', 'todo', 21),
  (gen_random_uuid()::text, 'nice', 0, 'Staging in Amsterdam', 'todo', 22),
  (gen_random_uuid()::text, 'nice', 0, 'Backlink-MCP', 'todo', 23),
  (gen_random_uuid()::text, 'nice', 0, 'Tweestapsverificatie voor klanten', 'todo', 24),
  (gen_random_uuid()::text, 'nice', 0, 'Publishers terug in het menu', 'todo', 25),
  (gen_random_uuid()::text, 'nice', 0, 'Opmaak voor alle e-mails', 'done', 26),
  (gen_random_uuid()::text, 'nice', 0, 'Oude factuur corrigeren', 'skip', 27),
  (gen_random_uuid()::text, 'nice', 0, 'Opmaak mails zelf aanpassen', 'todo', 28);
