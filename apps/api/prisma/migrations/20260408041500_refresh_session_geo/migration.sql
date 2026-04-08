-- AlterTable
ALTER TABLE "RefreshSession"
ADD COLUMN "deviceLabel" TEXT,
ADD COLUMN "geoCity" TEXT,
ADD COLUMN "geoRegion" TEXT,
ADD COLUMN "geoCountry" TEXT,
ADD COLUMN "geoCountryCode" TEXT,
ADD COLUMN "geoTimezone" TEXT;
