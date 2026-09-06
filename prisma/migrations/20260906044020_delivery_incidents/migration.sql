-- CreateEnum
CREATE TYPE "DeliveryIncidentVerdict" AS ENUM ('REJECTED_FALSE', 'REJECTED_BY_CUSTOMER', 'CANCELLED_NO_RESPONSE');

-- CreateEnum
CREATE TYPE "DeliveryIncidentSurveyAnswer" AS ENUM ('NOBODY_CAME', 'DELIVERED_BUT_REFUSED', 'OTHER');

-- CreateTable
CREATE TABLE "FulfillmentEventLog" (
    "id" TEXT NOT NULL,
    "shopifyFulfillmentEventId" TEXT NOT NULL,
    "shopifyFulfillmentId" TEXT,
    "shopifyOrderId" TEXT,
    "status" TEXT,
    "message" TEXT,
    "rawPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FulfillmentEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryIncident" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "carrierName" TEXT,
    "postalCode" TEXT NOT NULL,
    "municipality" TEXT,
    "rawStatus" TEXT,
    "rawMessage" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "surveyToken" TEXT NOT NULL,
    "surveyRespondedAt" TIMESTAMP(3),
    "surveyAnswer" "DeliveryIncidentSurveyAnswer",
    "surveyComment" TEXT,
    "verdict" "DeliveryIncidentVerdict",
    "reportedToDropiAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockedZone" (
    "id" TEXT NOT NULL,
    "postalCode" TEXT,
    "municipality" TEXT,
    "carrierName" TEXT,
    "reason" TEXT NOT NULL,
    "incidentsReference" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reactivatedAt" TIMESTAMP(3),
    "reactivatedBy" TEXT,

    CONSTRAINT "BlockedZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FulfillmentEventLog_shopifyFulfillmentEventId_key" ON "FulfillmentEventLog"("shopifyFulfillmentEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryIncident_surveyToken_key" ON "DeliveryIncident"("surveyToken");

-- CreateIndex
CREATE INDEX "DeliveryIncident_postalCode_carrierName_idx" ON "DeliveryIncident"("postalCode", "carrierName");

-- CreateIndex
CREATE INDEX "DeliveryIncident_carrierName_idx" ON "DeliveryIncident"("carrierName");

-- CreateIndex
CREATE INDEX "DeliveryIncident_orderId_idx" ON "DeliveryIncident"("orderId");

-- CreateIndex
CREATE INDEX "BlockedZone_postalCode_carrierName_idx" ON "BlockedZone"("postalCode", "carrierName");

-- AddForeignKey
ALTER TABLE "DeliveryIncident" ADD CONSTRAINT "DeliveryIncident_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
