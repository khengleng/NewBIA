DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnchainStatus') THEN
    CREATE TYPE "OnchainStatus" AS ENUM ('PENDING', 'MINTED', 'FAILED', 'SKIPPED');
  END IF;
END $$;

ALTER TABLE "syndicates"
  ADD COLUMN IF NOT EXISTS "tokenContractAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "tokenChainId" INTEGER,
  ADD COLUMN IF NOT EXISTS "mintTxHash" TEXT,
  ADD COLUMN IF NOT EXISTS "onchainStatus" "OnchainStatus",
  ADD COLUMN IF NOT EXISTS "launchpadEscrowAddress" TEXT;
