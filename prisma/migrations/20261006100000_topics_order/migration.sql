-- CBD is no longer offered; orders keep the name they were placed with
-- (OrderItem.topicNameSnap), their link to the topic is cleared.
DELETE FROM "Topic" WHERE "name" = 'CBD';

-- Casino and Dating at the bottom of the list.
UPDATE "Topic" SET "sortOrder" = 1 WHERE "name" = 'Lening';
UPDATE "Topic" SET "sortOrder" = 2 WHERE "name" = 'Crypto';
UPDATE "Topic" SET "sortOrder" = 3 WHERE "name" = 'Casino';
UPDATE "Topic" SET "sortOrder" = 4 WHERE "name" = 'Dating';
