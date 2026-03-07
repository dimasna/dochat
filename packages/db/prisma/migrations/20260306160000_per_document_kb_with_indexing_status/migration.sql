-- Add KB fields to KnowledgeDocument (per-document KB model)
ALTER TABLE "KnowledgeDocument" ADD COLUMN "gradientKbUuid" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "gradientDatasourceUuid" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "indexingStatus" TEXT NOT NULL DEFAULT 'pending';

-- Add shared OpenSearch DB ID to Subscription
ALTER TABLE "Subscription" ADD COLUMN "openSearchDatabaseId" TEXT;

-- Remove per-agent KB UUID from Agent (KBs are now on documents)
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "gradientKbUuid";

-- Simplify AgentDocument (remove per-agent indexing fields)
ALTER TABLE "AgentDocument" DROP COLUMN IF EXISTS "gradientSourceId";
ALTER TABLE "AgentDocument" DROP COLUMN IF EXISTS "status";
