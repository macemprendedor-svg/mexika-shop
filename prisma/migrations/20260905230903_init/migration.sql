-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'QUANTITY_REVIEW', 'BLOCKED_QUANTITY', 'SENT_TO_DROPI', 'CANCELLED_NOT_CONFIRMED', 'CANCELLED_MANUAL');

-- CreateEnum
CREATE TYPE "ConfirmationChannel" AS ENUM ('EMAIL', 'SMS', 'MANUAL');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "shopifyOrderName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "totalQuantity" INTEGER NOT NULL,
    "totalPrice" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "shippingAddressJson" TEXT,
    "lineItemsJson" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "shopifyCreatedAt" TIMESTAMP(3) NOT NULL,
    "scheduledEmail2At" TIMESTAMP(3) NOT NULL,
    "scheduledSmsAt" TIMESTAMP(3) NOT NULL,
    "email1SentAt" TIMESTAMP(3),
    "email2SentAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "confirmationToken" TEXT NOT NULL,
    "confirmationTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmedVia" "ConfirmationChannel",
    "quantityFilterResult" TEXT,
    "quantityReviewDecision" TEXT,
    "quantityReviewDecidedAt" TIMESTAMP(3),
    "quantityReviewDecidedBy" TEXT,
    "markedPaidAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "rawPayload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_shopifyOrderId_key" ON "Order"("shopifyOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_confirmationToken_key" ON "Order"("confirmationToken");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
