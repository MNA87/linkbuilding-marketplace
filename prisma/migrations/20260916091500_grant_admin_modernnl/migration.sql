-- One-off data fix: modernnl@gmail.com registered through the public
-- signup form (customer/supplier only) and should have been an admin.
-- No-op if the user or the admin role doesn't exist (0 rows affected).
UPDATE "User"
SET "roleId" = (SELECT id FROM "Role" WHERE name = 'admin' LIMIT 1)
WHERE email = 'modernnl@gmail.com';
