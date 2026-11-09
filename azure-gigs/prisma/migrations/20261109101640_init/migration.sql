-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEARNER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'LEARNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "shellState" JSONB NOT NULL DEFAULT '{}',
    "organizationId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Enabled',
    "isSimulated" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedResource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subscriptionDbId" TEXT NOT NULL,
    "resourceGroup" TEXT NOT NULL,
    "rgKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Succeeded',
    "properties" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatedResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceDependency" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "ResourceDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommandHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shell" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "stdout" TEXT NOT NULL,
    "stderr" TEXT NOT NULL,
    "exitCode" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommandHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT,
    "resourceName" TEXT,
    "resourceType" TEXT,
    "resourceGroup" TEXT,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "caller" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'portal',
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "pathId" TEXT NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleLab" (
    "moduleId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ModuleLab_pkey" PRIMARY KEY ("moduleId","labId")
);

-- CreateTable
CREATE TABLE "Lab" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "prerequisites" JSONB NOT NULL DEFAULT '[]',
    "durationMinutes" INTEGER NOT NULL,
    "expectedOutcome" TEXT NOT NULL,
    "commands" JSONB NOT NULL DEFAULT '[]',
    "commonMistakes" JSONB NOT NULL DEFAULT '[]',
    "hints" JSONB NOT NULL DEFAULT '[]',
    "solution" TEXT NOT NULL,
    "interviewQuestions" JSONB NOT NULL DEFAULT '[]',
    "checks" JSONB NOT NULL,
    "isCapstone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabStep" (
    "id" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "LabStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabScore" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "configuration" INTEGER NOT NULL,
    "execution" INTEGER NOT NULL,
    "security" INTEGER NOT NULL,
    "documentation" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "results" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "faultType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "targetResourceId" TEXT,
    "faultState" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentResolution" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "rootCause" TEXT NOT NULL,
    "fixSummary" TEXT NOT NULL,
    "verification" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "moduleId" TEXT,
    "title" TEXT NOT NULL,
    "questions" JSONB NOT NULL,
    "passMark" INTEGER NOT NULL DEFAULT 70,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "learnerName" TEXT NOT NULL,
    "completedLabs" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedAzureAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountUpn" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "defaultSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectedAzureAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_subscriptionId_key" ON "Subscription"("subscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "SimulatedResource_userId_type_idx" ON "SimulatedResource"("userId", "type");

-- CreateIndex
CREATE INDEX "SimulatedResource_userId_rgKey_idx" ON "SimulatedResource"("userId", "rgKey");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedResource_userId_type_rgKey_nameKey_key" ON "SimulatedResource"("userId", "type", "rgKey", "nameKey");

-- CreateIndex
CREATE INDEX "ResourceDependency_toId_idx" ON "ResourceDependency"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceDependency_fromId_toId_kind_key" ON "ResourceDependency"("fromId", "toId", "kind");

-- CreateIndex
CREATE INDEX "CommandHistory_userId_createdAt_idx" ON "CommandHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_resourceId_idx" ON "ActivityLog"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPath_slug_key" ON "LearningPath"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Module_slug_key" ON "Module"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lab_slug_key" ON "Lab"("slug");

-- CreateIndex
CREATE INDEX "LabStep_labId_idx" ON "LabStep"("labId");

-- CreateIndex
CREATE INDEX "LabSubmission_userId_labId_idx" ON "LabSubmission"("userId", "labId");

-- CreateIndex
CREATE UNIQUE INDEX "LabScore_submissionId_key" ON "LabScore"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgress_userId_labId_key" ON "UserProgress"("userId", "labId");

-- CreateIndex
CREATE INDEX "Incident_userId_status_idx" ON "Incident"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentResolution_incidentId_key" ON "IncidentResolution"("incidentId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_slug_key" ON "Assessment"("slug");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_userId_assessmentId_idx" ON "AssessmentAttempt"("userId", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_certificateId_key" ON "Certificate"("certificateId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_userId_pathId_key" ON "Certificate"("userId", "pathId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedAzureAccount_userId_tenantId_key" ON "ConnectedAzureAccount"("userId", "tenantId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedResource" ADD CONSTRAINT "SimulatedResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedResource" ADD CONSTRAINT "SimulatedResource_subscriptionDbId_fkey" FOREIGN KEY ("subscriptionDbId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDependency" ADD CONSTRAINT "ResourceDependency_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "SimulatedResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceDependency" ADD CONSTRAINT "ResourceDependency_toId_fkey" FOREIGN KEY ("toId") REFERENCES "SimulatedResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommandHistory" ADD CONSTRAINT "CommandHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLab" ADD CONSTRAINT "ModuleLab_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleLab" ADD CONSTRAINT "ModuleLab_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabStep" ADD CONSTRAINT "LabStep_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSubmission" ADD CONSTRAINT "LabSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabSubmission" ADD CONSTRAINT "LabSubmission_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabScore" ADD CONSTRAINT "LabScore_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LabSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentResolution" ADD CONSTRAINT "IncidentResolution_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "LearningPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectedAzureAccount" ADD CONSTRAINT "ConnectedAzureAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
