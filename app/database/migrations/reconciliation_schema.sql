-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS');

-- CreateTable
CREATE TABLE "ReconciliationBundle" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'COMPLETED',
    "locationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationItem" (
    "id" TEXT NOT NULL,
    "rfidTag" TEXT NOT NULL,
    "assetId" TEXT,
    "assetName" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT,
    "location" TEXT,
    "locationMismatch" BOOLEAN NOT NULL DEFAULT false,
    "bundleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationBundle_bundleId_key" ON "ReconciliationBundle"("bundleId");

-- CreateIndex
CREATE INDEX "ReconciliationBundle_organizationId_idx" ON "ReconciliationBundle"("organizationId");

-- CreateIndex
CREATE INDEX "ReconciliationBundle_locationId_idx" ON "ReconciliationBundle"("locationId");

-- CreateIndex
CREATE INDEX "ReconciliationBundle_userId_idx" ON "ReconciliationBundle"("userId");

-- CreateIndex
CREATE INDEX "ReconciliationBundle_date_idx" ON "ReconciliationBundle"("date");

-- CreateIndex
CREATE INDEX "ReconciliationItem_bundleId_idx" ON "ReconciliationItem"("bundleId");

-- CreateIndex
CREATE INDEX "ReconciliationItem_rfidTag_idx" ON "ReconciliationItem"("rfidTag");

-- CreateIndex
CREATE INDEX "ReconciliationItem_assetId_idx" ON "ReconciliationItem"("assetId");

-- AddForeignKey
ALTER TABLE "ReconciliationBundle" ADD CONSTRAINT "ReconciliationBundle_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationBundle" ADD CONSTRAINT "ReconciliationBundle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationBundle" ADD CONSTRAINT "ReconciliationBundle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationItem" ADD CONSTRAINT "ReconciliationItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ReconciliationBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
