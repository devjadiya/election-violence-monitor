-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('UNDER_18', 'AGE_18_25', 'AGE_26_40', 'AGE_41_60', 'ABOVE_60', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'VERIFIED', 'PUBLISHED', 'REJECTED', 'DELETED');

-- CreateEnum
CREATE TYPE "ElectionStage" AS ENUM ('PRE_CAMPAIGN', 'CAMPAIGN', 'ELECTION_DAY', 'VOTE_COUNTING', 'POST_ELECTION', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('PHYSICAL_ASSAULT', 'ARMED_ATTACK', 'VOTER_INTIMIDATION', 'POLITICAL_PARTY_CLASH', 'POLLING_UNIT_DISRUPTION', 'INFRASTRUCTURE_ATTACK', 'PROPERTY_DAMAGE', 'SECURITY_FORCE_MISCONDUCT', 'KIDNAPPING', 'POST_ELECTION_VIOLENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('RAW', 'FLAGGED', 'UNDER_REVIEW', 'VERIFIED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('RSS_FEED', 'API', 'MANUAL', 'WEB_SCRAPE', 'OBSERVER_REPORT', 'NGO_REPORT');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PUBLIC', 'OBSERVER', 'ANALYST', 'REVIEWER', 'EDITOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED', 'UNDER_VERIFICATION');

-- CreateEnum
CREATE TYPE "VictimGender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VictimRole" AS ENUM ('VOTER', 'CANDIDATE', 'CAMPAIGN_STAFF', 'ELECTION_OFFICIAL', 'ELECTION_OBSERVER', 'JOURNALIST', 'PARTY_SUPPORTER', 'SECURITY_PERSONNEL', 'COMMUNITY_MEMBER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WeaponType" AS ENUM ('FIREARMS', 'KNIVES_MACHETES', 'BLUNT_OBJECTS', 'EXPLOSIVES', 'IMPROVISED', 'NONE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Actor" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "name" TEXT,
    "partyName" TEXT,
    "isPerpetratorSuspected" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Actor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "notes" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "countryCode" VARCHAR(3) NOT NULL,
    "electionDate" TIMESTAMP(6) NOT NULL,
    "electionType" TEXT NOT NULL,
    "wikidataId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TIMESTAMP(6),
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "IncidentCategory" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'RAW',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "electionStage" "ElectionStage" NOT NULL DEFAULT 'UNKNOWN',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isAutoDetected" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT NOT NULL,
    "countryCode" VARCHAR(3),
    "region" TEXT,
    "district" TEXT,
    "community" TEXT,
    "specificLocation" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(6) NOT NULL,
    "reportedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "injured" INTEGER NOT NULL DEFAULT 0,
    "fatalities" INTEGER NOT NULL DEFAULT 0,
    "arrested" INTEGER NOT NULL DEFAULT 0,
    "propertyDamage" BOOLEAN NOT NULL DEFAULT false,
    "votingDisrupted" BOOLEAN NOT NULL DEFAULT false,
    "weaponType" "WeaponType" NOT NULL DEFAULT 'UNKNOWN',
    "weaponDetails" TEXT,
    "wikidataId" TEXT,
    "electionId" TEXT,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(6),
    "rejectedAt" TIMESTAMP(6),

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentSource" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(6),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionLog" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "jobType" TEXT NOT NULL,
    "articlesFound" INTEGER NOT NULL DEFAULT 0,
    "articlesNew" INTEGER NOT NULL DEFAULT 0,
    "incidentsCreated" INTEGER NOT NULL DEFAULT 0,
    "errors" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(6),

    CONSTRAINT "IngestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rssUrl" TEXT,
    "apiEndpoint" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'RSS_FEED',
    "country" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "lastFetchedAt" TIMESTAMP(6),
    "electionId" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoredSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawArticle" (
    "id" TEXT NOT NULL,
    "urlHash" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "publishedAt" TIMESTAMP(6),
    "fetchedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isElectionRelated" BOOLEAN NOT NULL DEFAULT false,
    "isViolenceRelated" BOOLEAN NOT NULL DEFAULT false,
    "pass1Score" DOUBLE PRECISION,
    "pass1At" TIMESTAMP(6),
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "pass2At" TIMESTAMP(6),
    "sourceId" TEXT NOT NULL,

    CONSTRAINT "RawArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipSubmission" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "occurredAt" TIMESTAMP(6),
    "category" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "submitterId" TEXT,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(6),
    "image" TEXT,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ANALYST',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(6) NOT NULL
);

-- CreateTable
CREATE TABLE "Victim" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "role" "VictimRole" NOT NULL DEFAULT 'UNKNOWN',
    "gender" "VictimGender" NOT NULL DEFAULT 'UNKNOWN',
    "ageGroup" "AgeGroup" NOT NULL DEFAULT 'UNKNOWN',
    "count" INTEGER NOT NULL DEFAULT 1,
    "nameAnonymized" BOOLEAN NOT NULL DEFAULT true,
    "hasDisability" BOOLEAN,
    "ethnicGroup" TEXT,
    "religiousGroup" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Victim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_IncidentArticles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId" ASC);

-- CreateIndex
CREATE INDEX "Actor_incidentId_idx" ON "Actor"("incidentId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_incidentId_idx" ON "AuditLog"("incidentId" ASC);

-- CreateIndex
CREATE INDEX "Election_country_idx" ON "Election"("country" ASC);

-- CreateIndex
CREATE INDEX "Election_isActive_idx" ON "Election"("isActive" ASC);

-- CreateIndex
CREATE INDEX "Incident_category_idx" ON "Incident"("category" ASC);

-- CreateIndex
CREATE INDEX "Incident_country_idx" ON "Incident"("country" ASC);

-- CreateIndex
CREATE INDEX "Incident_latlong_idx" ON "Incident"("latitude" ASC, "longitude" ASC);

-- CreateIndex
CREATE INDEX "Incident_occurredAt_idx" ON "Incident"("occurredAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Incident_referenceId_key" ON "Incident"("referenceId" ASC);

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredSource_url_key" ON "MonitoredSource"("url" ASC);

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId" ASC, "isRead" ASC);

-- CreateIndex
CREATE INDEX "RawArticle_fetchedAt_idx" ON "RawArticle"("fetchedAt" ASC);

-- CreateIndex
CREATE INDEX "RawArticle_processed_idx" ON "RawArticle"("isProcessed" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RawArticle_urlHash_key" ON "RawArticle"("urlHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token" ASC);

-- CreateIndex
CREATE INDEX "Victim_incidentId_idx" ON "Victim"("incidentId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "_IncidentArticles_A_B_key" ON "_IncidentArticles"("A" ASC, "B" ASC);

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Actor" ADD CONSTRAINT "Actor_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "IncidentSource" ADD CONSTRAINT "IncidentSource_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MonitoredSource" ADD CONSTRAINT "MonitoredSource_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "RawArticle" ADD CONSTRAINT "RawArticle_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MonitoredSource"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TipSubmission" ADD CONSTRAINT "TipSubmission_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Victim" ADD CONSTRAINT "Victim_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "_IncidentArticles" ADD CONSTRAINT "_IncidentArticles_A_fkey" FOREIGN KEY ("A") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "_IncidentArticles" ADD CONSTRAINT "_IncidentArticles_B_fkey" FOREIGN KEY ("B") REFERENCES "RawArticle"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

