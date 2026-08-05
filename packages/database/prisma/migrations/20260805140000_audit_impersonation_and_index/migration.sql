-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "impersonatedBy" TEXT;

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
