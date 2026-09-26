-- CreateTable
CREATE TABLE "ApiCredential" (
    "provider" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiCredential_pkey" PRIMARY KEY ("provider")
);
