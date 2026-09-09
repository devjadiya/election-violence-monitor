-- Sign-in history.
--
-- Sessions are JWT, so no Session row is ever written and the database held no
-- record of who signed in or from where. Additive only: creates one table and
-- its indexes, touches no existing column or row.

CREATE TABLE IF NOT EXISTS "LoginEvent" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT,
    "email"     TEXT NOT NULL,
    "success"   BOOLEAN NOT NULL,
    "reason"    TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LoginEvent_userId_idx"    ON "LoginEvent"("userId");
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "LoginEvent_email_idx"     ON "LoginEvent"("email");

-- Deleting a user must not erase the history of their sign-ins, so the
-- reference is severed rather than cascaded.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'LoginEvent_userId_fkey'
    ) THEN
        ALTER TABLE "LoginEvent"
            ADD CONSTRAINT "LoginEvent_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;
