import React from 'react';
import { IncidentDetailView } from '../../../../components/incidents/incident-detail-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <IncidentDetailView incidentId={id} />;
}
