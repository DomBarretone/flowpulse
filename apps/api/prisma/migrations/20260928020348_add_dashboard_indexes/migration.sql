-- CreateIndex
CREATE INDEX "executions_created_at_status_idx" ON "executions"("created_at", "status");

-- CreateIndex
CREATE INDEX "incidents_opened_at_status_idx" ON "incidents"("opened_at", "status");
