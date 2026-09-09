-- Records who handled a tip and when.
--
-- With more than one administrator, "reviewed" with no name attached is the
-- reason two people work the same tip. Additive only: two nullable columns and
-- an index. No existing row changes.

ALTER TABLE "TipSubmission" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;
ALTER TABLE "TipSubmission" ADD COLUMN IF NOT EXISTS "reviewedAt"   TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "TipSubmission_reviewedById_idx" ON "TipSubmission"("reviewedById");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'TipSubmission_reviewedById_fkey'
    ) THEN
        ALTER TABLE "TipSubmission"
            ADD CONSTRAINT "TipSubmission_reviewedById_fkey"
            FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
