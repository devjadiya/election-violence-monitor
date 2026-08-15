-- Additive only. No column is dropped, no row is deleted, no type is altered.
--
-- Deliberately EXCLUDED from this migration: normalising the datetime columns
-- from timestamp(6) to Prisma's timestamp(3). Both are "without time zone", so
-- the difference is precision alone and carries no timezone-reinterpretation
-- risk -- but ALTER COLUMN ... TYPE rewrites the whole table under an ACCESS
-- EXCLUSIVE lock for no functional gain. The divergence is left in place and
-- documented instead.

-- ---------------------------------------------------------------------------
-- 1. Incident: demo quarantine + extraction provenance
-- ---------------------------------------------------------------------------
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "isDemo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "evidence" JSONB;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "extractionModel" TEXT;
ALTER TABLE "Incident" ADD COLUMN IF NOT EXISTS "promptVersion" TEXT;

-- ---------------------------------------------------------------------------
-- 2. MonitoredSource: real health, separate from "we tried"
-- ---------------------------------------------------------------------------
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "lastSuccessAt" TIMESTAMP(3);
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "MonitoredSource" ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 3. RawArticle: how the body was obtained
-- ---------------------------------------------------------------------------
ALTER TABLE "RawArticle" ADD COLUMN IF NOT EXISTS "bodyFetchedAt" TIMESTAMP(3);
ALTER TABLE "RawArticle" ADD COLUMN IF NOT EXISTS "bodyMethod" TEXT;

-- ---------------------------------------------------------------------------
-- 4. Indexes declared in schema.prisma that never existed in production.
--    The database was only ever created with `db push` from an older schema,
--    so all fifteen were missing -- including RawArticle_isProcessed_idx,
--    which the classification queue scans on every run.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "Election_electionDate_idx" ON "Election"("electionDate");
CREATE INDEX IF NOT EXISTS "FollowUp_incidentId_idx" ON "FollowUp"("incidentId");
CREATE INDEX IF NOT EXISTS "Incident_electionStage_idx" ON "Incident"("electionStage");
CREATE INDEX IF NOT EXISTS "Incident_confidenceScore_idx" ON "Incident"("confidenceScore");
CREATE INDEX IF NOT EXISTS "Incident_latitude_longitude_idx" ON "Incident"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "IncidentSource_incidentId_idx" ON "IncidentSource"("incidentId");
CREATE INDEX IF NOT EXISTS "IngestionLog_startedAt_idx" ON "IngestionLog"("startedAt");
CREATE INDEX IF NOT EXISTS "IngestionLog_jobType_idx" ON "IngestionLog"("jobType");
CREATE INDEX IF NOT EXISTS "MonitoredSource_isActive_idx" ON "MonitoredSource"("isActive");
CREATE INDEX IF NOT EXISTS "MonitoredSource_country_idx" ON "MonitoredSource"("country");
CREATE INDEX IF NOT EXISTS "RawArticle_isElectionRelated_isViolenceRelated_idx" ON "RawArticle"("isElectionRelated", "isViolenceRelated");
CREATE INDEX IF NOT EXISTS "RawArticle_sourceId_idx" ON "RawArticle"("sourceId");
CREATE INDEX IF NOT EXISTS "RawArticle_isProcessed_idx" ON "RawArticle"("isProcessed");
CREATE INDEX IF NOT EXISTS "TipSubmission_isReviewed_idx" ON "TipSubmission"("isReviewed");

-- New indexes for the columns added above
CREATE INDEX IF NOT EXISTS "MonitoredSource_lastSuccessAt_idx" ON "MonitoredSource"("lastSuccessAt");
CREATE INDEX IF NOT EXISTS "Incident_isDemo_status_idx" ON "Incident"("isDemo", "status");
