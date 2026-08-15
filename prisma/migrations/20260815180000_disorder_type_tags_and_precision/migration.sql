-- Track 1: taxonomy, tags, and honest precision fields.
--
-- Every statement is additive. Nothing is dropped, nothing is retyped, and
-- every new column is nullable or carries a default, so the running deployment
-- keeps working against the old client until it is redeployed.
--
-- Motivation, from the live public API on Osun election day:
--   * a mass arrest of 146 suspected mercenaries was coded OTHER
--   * an incident in Ikire, Osun was published with country = 'Unknown'
--   * occurredAt held the article's publication time, presented as the event time
--   * latitude/longitude were null with no record of whether geocoding was tried

-- New broad class. Violence totals are computed from POLITICAL_VIOLENCE only,
-- so recording a strategic development cannot inflate a harm figure.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisorderType') THEN
    CREATE TYPE "DisorderType" AS ENUM ('POLITICAL_VIOLENCE', 'DEMONSTRATION', 'STRATEGIC_DEVELOPMENT');
  END IF;
END
$$;

-- Categories the taxonomy had no bucket for.
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'MASS_ARREST_DETENTION';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'ABDUCTION_THREAT';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'MOB_VIOLENCE';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'ATTACK_ON_JOURNALIST';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'ATTACK_ON_OFFICIAL';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'VOTE_BUYING_INDUCEMENT';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'BALLOT_INTEGRITY_BREACH';
ALTER TYPE "IncidentCategory" ADD VALUE IF NOT EXISTS 'PROTEST_UNREST';

ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "disorderType" "DisorderType" NOT NULL DEFAULT 'POLITICAL_VIOLENCE';
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "geocodeStatus" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "countryResolvedVia" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "occurredAtPrecision" TEXT;

-- Existing rows all took occurredAt from the article's publication time. Say so
-- rather than leaving it null, which would read as "precision unknown" when we
-- know exactly how imprecise it is.
UPDATE "Incident" SET "occurredAtPrecision" = 'REPORTED_ON' WHERE "occurredAtPrecision" IS NULL;

-- Public listings filter on disorder type to separate violence from strategic
-- developments, alongside the existing isDemo/status pair.
CREATE INDEX IF NOT EXISTS "Incident_disorderType_idx" ON "Incident"("disorderType");
