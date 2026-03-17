-- CreateTable
CREATE TABLE "syndicate_token_listings" (
    "id" TEXT NOT NULL,
    "syndicateId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "tokensAvailable" DOUBLE PRECISION NOT NULL,
    "pricePerToken" DOUBLE PRECISION NOT NULL,
    "minTokens" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "listedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syndicate_token_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syndicate_token_trades" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "tokens" DOUBLE PRECISION NOT NULL,
    "pricePerToken" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syndicate_token_trades_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "syndicate_token_listings" ADD CONSTRAINT "syndicate_token_listings_syndicateId_fkey" FOREIGN KEY ("syndicateId") REFERENCES "syndicates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syndicate_token_listings" ADD CONSTRAINT "syndicate_token_listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syndicate_token_trades" ADD CONSTRAINT "syndicate_token_trades_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "syndicate_token_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syndicate_token_trades" ADD CONSTRAINT "syndicate_token_trades_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syndicate_token_trades" ADD CONSTRAINT "syndicate_token_trades_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "investors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
