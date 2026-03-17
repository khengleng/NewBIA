-- AlterTable
ALTER TABLE "syndicate_members" ADD COLUMN     "tokens" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "syndicates" ADD COLUMN     "isTokenized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pricePerToken" DOUBLE PRECISION,
ADD COLUMN     "tokenName" TEXT,
ADD COLUMN     "tokenSymbol" TEXT,
ADD COLUMN     "tokensSold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalTokens" DOUBLE PRECISION;
