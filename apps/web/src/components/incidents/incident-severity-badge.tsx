import React from 'react';
import { ShieldAlert, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { IncidentSeverity } from '../../lib/api/incidents';

export function IncidentSeverityBadge({ severity }: { severity: IncidentSeverity }) {
  switch (severity) {
    case 'CRITICAL':
      return (
        <span
          data-testid="incident-severity-badge-critical"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40"
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-400" aria-hidden="true" />
          Crítica
        </span>
      );
    case 'HIGH':
      return (
        <span
          data-testid="incident-severity-badge-high"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/40"
        >
          <AlertOctagon className="w-3.5 h-3.5 mr-1 text-orange-400" aria-hidden="true" />
          Alta
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          data-testid="incident-severity-badge-medium"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40"
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400" aria-hidden="true" />
          Média
        </span>
      );
    case 'LOW':
    default:
      return (
        <span
          data-testid="incident-severity-badge-low"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40"
        >
          <Info className="w-3.5 h-3.5 mr-1 text-sky-400" aria-hidden="true" />
          Baixa
        </span>
      );
  }
}
