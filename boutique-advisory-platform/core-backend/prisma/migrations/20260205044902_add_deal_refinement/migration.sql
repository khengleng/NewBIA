-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "isDocumentLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "terms" TEXT;
