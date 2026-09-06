-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "reminder1SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder2SentAt" TIMESTAMP(3),
ADD COLUMN     "reminder3SentAt" TIMESTAMP(3),
ADD COLUMN     "telegramChatId" TEXT,
ADD COLUMN     "telegramLinkedAt" TIMESTAMP(3);
