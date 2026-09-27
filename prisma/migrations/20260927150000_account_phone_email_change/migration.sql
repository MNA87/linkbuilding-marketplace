-- AlterTable
ALTER TABLE "User" ADD COLUMN     "pendingEmail" TEXT,
ADD COLUMN     "pendingEmailTokenExpires" TIMESTAMP(3),
ADD COLUMN     "pendingEmailTokenHash" TEXT,
ADD COLUMN     "phone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmailTokenHash_key" ON "User"("pendingEmailTokenHash");
