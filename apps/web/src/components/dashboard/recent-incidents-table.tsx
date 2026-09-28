import React from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { RecentIncidentItem } from '../../lib/api/dashboard';
import { IncidentSeverityBadge } from '../incidents/incident-severity-badge';
import { IncidentStatusBadge } from '../incidents/incident-status-badge';

interface RecentIncidentsTableProps {
  incidents: RecentIncidentItem[];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 60) {
    return 'há poucos segundos';
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `há ${diffMinutes} ${diffMinutes === 1 ? 'minuto' : 'minutos'}`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return `há ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function RecentIncidentsTable({ incidents }: RecentIncidentsTableProps) {
  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4"
      role="region"
      aria-label="Incidentes operacionais prioritários recentes"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" aria-hidden="true" />
            <span>Incidentes Recentes Prioritários</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Ordenados por criticidade operacional (não resolvidos, severidade e abertura)
          </p>
        </div>
        <Link
          href="/incidents"
          className="inline-flex items-center text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Ver todos os incidentes
          <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
        </Link>
      </div>

      {incidents.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 text-center space-y-2"
          data-testid="recent-incidents-empty"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          <p className="text-sm font-medium text-zinc-300">
            Nenhum incidente operacional registrado
          </p>
          <p className="text-xs text-zinc-500">
            Todas as automações estão operando normalmente sem incidentes em aberto.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400 uppercase tracking-wider">
                <th scope="col" className="pb-3 font-medium">
                  Severidade
                </th>
                <th scope="col" className="pb-3 font-medium">
                  Status
                </th>
                <th scope="col" className="pb-3 font-medium">
                  Automação
                </th>
                <th scope="col" className="pb-3 font-medium">
                  Aberto em
                </th>
                <th scope="col" className="pb-3 font-medium">
                  Responsável
                </th>
                <th scope="col" className="pb-3 font-medium text-right">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="hover:bg-zinc-800/30 transition-colors"
                  data-testid={`recent-incident-row-${incident.id}`}
                >
                  <td className="py-3 pr-3">
                    <IncidentSeverityBadge severity={incident.severity} />
                  </td>
                  <td className="py-3 pr-3">
                    <IncidentStatusBadge status={incident.status} />
                  </td>
                  <td className="py-3 pr-3">
                    <span className="font-medium text-white truncate max-w-[200px] block">
                      {incident.automation.name}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-zinc-300 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                      {formatRelativeTime(incident.opened_at)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-zinc-300 whitespace-nowrap">
                    {incident.assigned_to ? (
                      <span title={incident.assigned_to.email} className="text-zinc-200">
                        {incident.assigned_to.name}
                      </span>
                    ) : (
                      <span className="text-zinc-500 italic">Não atribuído</span>
                    )}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/incidents/${incident.id}`}
                      className="inline-flex items-center px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Investigar
                      <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
