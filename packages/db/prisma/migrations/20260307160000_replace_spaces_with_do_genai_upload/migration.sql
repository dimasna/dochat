-- Replace DO Spaces fields with DO GenAI direct upload field
ALTER TABLE "KnowledgeDocument" ADD COLUMN "storedObjectKey" TEXT;
ALTER TABLE "KnowledgeDocument" DROP COLUMN IF EXISTS "spacesKey";
ALTER TABLE "KnowledgeDocument" DROP COLUMN IF EXISTS "fileUrl";
