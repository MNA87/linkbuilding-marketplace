-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "menuColorAdmin" TEXT NOT NULL DEFAULT '#059669',
ADD COLUMN     "menuColorBuy" TEXT NOT NULL DEFAULT '#2563eb',
ADD COLUMN     "menuColorManage" TEXT NOT NULL DEFAULT '#7c3aed';
