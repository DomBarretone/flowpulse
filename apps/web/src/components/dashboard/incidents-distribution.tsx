import React from 'react';
import { IncidentsByStatus, OpenIncidentsBySeverity } from '../../lib/api/dashboard';
import { PieChart, ShieldAlert } from 'lucide-react';

interface IncidentStatusDistributionProps {
  distribution: IncidentsByStatus;
}

export function IncidentStatusDistribution({ distribution }: IncidentStatusDistributionProps) {
  const total =
    distribution.OPEN +
    distribution.ACKNOWLEDGED +
    distribution.INVESTIGATING +
    distribution.RESOLVED;

  const items = [
    {
      key: 'OPEN',
      label: 'Abertos',
      count: distribution.OPEN,
      color: 'bg-red-500',
      textColor: 'text-red-400',
    },
    {
      key: 'ACKNOWLEDGED',
      label: 'Assumidos',
      count: distribution.ACKNOWLEDGED,
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
    },
    {
      key: 'INVESTIGATING',
      label: 'Em Investigação',
      count: distribution.INVESTIGATING,
      color: 'bg-blue-500',
      textColor: 'text-blue-400',
    },
    {
      key: 'RESOLVED',
      label: 'Resolvidos',
      count: distribution.RESOLVED,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-400',
    },
  ];

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4"
      role="region"
      aria-label="Distribuição global de incidentes por status"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-400" aria-hidden="true" />
            <span>Incidentes por Status (Global)</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Visão total histórica do ciclo de vida</p>
        </div>
        <span className="text-xs font-mono text-zinc-400">Total: {total}</span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          Nenhum incidente registrado no sistema
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {items.map((item) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{item.label}</span>
                  <span className="font-mono text-zinc-400">
                    <strong className={item.textColor}>{item.count}</strong> ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${item.color} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label={`${item.label}: ${item.count}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface IncidentSeverityDistributionProps {
  distribution: OpenIncidentsBySeverity;
}

export function IncidentSeverityDistribution({ distribution }: IncidentSeverityDistributionProps) {
  const total = distribution.LOW + distribution.MEDIUM + distribution.HIGH + distribution.CRITICAL;

  const items = [
    {
      key: 'CRITICAL',
      label: 'Crítica',
      count: distribution.CRITICAL,
      color: 'bg-rose-500',
      textColor: 'text-rose-400',
    },
    {
      key: 'HIGH',
      label: 'Alta',
      count: distribution.HIGH,
      color: 'bg-orange-500',
      textColor: 'text-orange-400',
    },
    {
      key: 'MEDIUM',
      label: 'Média',
      count: distribution.MEDIUM,
      color: 'bg-amber-500',
      textColor: 'text-amber-400',
    },
    {
      key: 'LOW',
      label: 'Baixa',
      count: distribution.LOW,
      color: 'bg-sky-500',
      textColor: 'text-sky-400',
    },
  ];

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4"
      role="region"
      aria-label="Distribuição de severidade dos incidentes abertos"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-orange-400" aria-hidden="true" />
            <span>Severidade do Backlog Ativo</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">Exclusivo para incidentes não resolvidos</p>
        </div>
        <span className="text-xs font-mono text-zinc-400">Ativos: {total}</span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-zinc-500">
          Nenhum incidente ativo no momento
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {items.map((item) => {
            const pct = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-300 font-medium">{item.label}</span>
                  <span className="font-mono text-zinc-400">
                    <strong className={item.textColor}>{item.count}</strong> ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-zinc-800/80 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${item.color} transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                    role="progressbar"
                    aria-valuenow={item.count}
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-label={`${item.label}: ${item.count}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
