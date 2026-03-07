-- Knowledge Base as Folder: KnowledgeDocument → KnowledgeBase + KnowledgeSource

-- 1. Create KnowledgeBase table
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradientKbUuid" TEXT,
    "indexingStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeBase_orgId_idx" ON "KnowledgeBase"("orgId");

-- 2. Create KnowledgeSource table
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'file',
    "title" TEXT NOT NULL,
    "fileName" TEXT,
    "storedObjectKey" TEXT,
    "sourceUrl" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "gradientDatasourceUuid" TEXT,
    "indexingStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeSource_knowledgeBaseId_idx" ON "KnowledgeSource"("knowledgeBaseId");

ALTER TABLE "KnowledgeSource" ADD CONSTRAINT "KnowledgeSource_knowledgeBaseId_fkey"
    FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Create AgentKnowledgeBase table
CREATE TABLE "AgentKnowledgeBase" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "knowledgeBaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentKnowledgeBase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentKnowledgeBase_agentId_knowledgeBaseId_key"
    ON "AgentKnowledgeBase"("agentId", "knowledgeBaseId");

ALTER TABLE "AgentKnowledgeBase" ADD CONSTRAINT "AgentKnowledgeBase_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentKnowledgeBase" ADD CONSTRAINT "AgentKnowledgeBase_knowledgeBaseId_fkey"
    FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Migrate data: each KnowledgeDocument → 1 KnowledgeBase + 1 KnowledgeSource
INSERT INTO "KnowledgeBase" ("id", "orgId", "name", "gradientKbUuid", "indexingStatus", "createdAt", "updatedAt")
SELECT "id", "orgId", "title", "gradientKbUuid", "indexingStatus", "createdAt", "updatedAt"
FROM "KnowledgeDocument";

INSERT INTO "KnowledgeSource" ("id", "knowledgeBaseId", "sourceType", "title", "fileName", "storedObjectKey", "sourceUrl", "mimeType", "fileSize", "gradientDatasourceUuid", "indexingStatus", "createdAt", "updatedAt")
SELECT
    "id" || '_src',
    "id",
    "sourceType",
    "title",
    "fileName",
    "storedObjectKey",
    "sourceUrl",
    "mimeType",
    "fileSize",
    "gradientDatasourceUuid",
    "indexingStatus",
    "createdAt",
    "updatedAt"
FROM "KnowledgeDocument";

-- 5. Migrate agent associations
INSERT INTO "AgentKnowledgeBase" ("id", "agentId", "knowledgeBaseId", "createdAt")
SELECT "id", "agentId", "knowledgeDocumentId", "createdAt"
FROM "AgentDocument";

-- 6. Drop old tables
DROP TABLE "AgentDocument";
DROP TABLE "KnowledgeDocument";
