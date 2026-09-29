-- CreateEnum
CREATE TYPE "IncidentEventType" AS ENUM ('ACKNOWLEDGED', 'INVESTIGATION_STARTED', 'AI_ANALYSIS_REQUESTED', 'AI_ANALYSIS_COMPLETED', 'RESOLVED');

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "acknowledged_at" TIMESTAMP(3),
ADD COLUMN     "assigned_to_id" TEXT,
ADD COLUMN     "investigating_at" TIMESTAMP(3),
ADD COLUMN     "resolution_notes" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "incident_events" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "event_type" "IncidentEventType" NOT NULL,
    "from_status" "IncidentStatus",
    "to_status" "IncidentStatus",
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_analyses" (
    "id" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "likely_causes" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "next_steps" JSONB NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "provider_request_id" TEXT,
    "latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_events_incident_id_created_at_idx" ON "incident_events"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_analyses_incident_id_created_at_idx" ON "ai_analyses"("incident_id", "created_at");

-- CreateIndex
CREATE INDEX "incidents_assigned_to_id_status_idx" ON "incidents"("assigned_to_id", "status");

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_analyses" ADD CONSTRAINT "ai_analyses_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
