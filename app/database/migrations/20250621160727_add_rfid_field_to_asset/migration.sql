-- DropIndex
DROP INDEX "_AssetToBooking_Asset_idx";

-- DropIndex
DROP INDEX "_AssetToTag_asset_idx";

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "rfid" TEXT;
