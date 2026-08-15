-- Additive only. No column dropped, no row deleted, no type altered.
--
-- Makes elections first-class and country-agnostic, and records HOW a record
-- reached publication so an automated pathway can never be displayed as though
-- a person had checked it.

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "ElectionStatus" AS ENUM ('UPCOMING', 'ONGOING', 'RECENTLY_COMPLETED', 'HISTORICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MonitoringStatus" AS ENUM ('ACTIVE', 'SCHEDULED', 'NOT_ACTIVE', 'CONCLUDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationPathway" AS ENUM ('PENDING', 'AUTOMATED_CORROBORATION', 'EDITORIAL_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2. Election: global model
-- ---------------------------------------------------------------------------
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "status" "ElectionStatus" NOT NULL DEFAULT 'UPCOMING';
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "monitoringStatus" "MonitoringStatus" NOT NULL DEFAULT 'NOT_ACTIVE';
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "currentStage" "ElectionStage" NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "registeredVoters" INTEGER;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "pollingUnits" INTEGER;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "administrativeAreas" INTEGER;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "administrativeAreaLabel" TEXT;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "coverageNote" TEXT;
ALTER TABLE "Election" ADD COLUMN IF NOT EXISTS "referenceUrl" TEXT;

CREATE INDEX IF NOT EXISTS "Election_status_idx" ON "Election"("status");
CREATE INDEX IF NOT EXISTS "Election_monitoringStatus_idx" ON "Election"("monitoringStatus");

-- Existing rows are historical unless a later backfill says otherwise. Safer
-- than defaulting everything to UPCOMING, which would misdate concluded polls.
UPDATE "Election"
   SET "status" = 'HISTORICAL', "monitoringStatus" = 'NOT_ACTIVE'
 WHERE "electionDate" < NOW() AND "status" = 'UPCOMING';

-- ---------------------------------------------------------------------------
-- 3. Incident: how it reached publication
-- ---------------------------------------------------------------------------
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "verificationPathway" "VerificationPathway" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "corroboratingSources" INTEGER NOT NULL DEFAULT 0;

-- The April 2026 seed records were published by a seed script, not by a
-- reviewer. Leaving them PENDING states that accurately.

-- ---------------------------------------------------------------------------
-- 4. MonitoredSource: registry metadata
-- ---------------------------------------------------------------------------
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "coverageScope" TEXT;
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "reliabilityTier" INTEGER;
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "coverageArea" TEXT;
