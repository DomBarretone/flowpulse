import React from 'react';
import { AlertCircle, Clock, Search, CheckCircle2 } from 'lucide-react';
import { IncidentStatus } from '../../lib/api/incidents';

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  switch (status) {
    case 'OPEN':
      return (
        <span
          data-testid="incident-status-badge-open"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-red-500/15 text-red-300 border border-red-500/40"
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1 text-red-400" aria-hidden="true" />
          Aberto
        </span>
      );
    case 'ACKNOWLEDGED':
      return (
        <span
          data-testid="incident-status-badge-acknowledged"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40"
        >
          <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" aria-hidden="true" />
          Assumido
        </span>
      );
    case 'INVESTIGATING':
      return (
        <span
          data-testid="incident-status-badge-investigating"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/40"
        >
          <Search className="w-3.5 h-3.5 mr-1 text-blue-400" aria-hidden="true" />
          Em Investigação
        </span>
      );
    case 'RESOLVED':
    default:
      return (
        <span
          data-testid="incident-status-badge-resolved"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" aria-hidden="true" />
          Resolvido
        </span>
      );
  }
}
