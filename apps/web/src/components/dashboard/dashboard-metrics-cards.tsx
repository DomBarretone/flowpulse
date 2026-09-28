import React from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PlayCircle,
  Timer,
} from 'lucide-react';
import { DashboardSummary } from '../../lib/api/dashboard';

export function formatDurationSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) {
    return '—';
  }
  const totalSeconds = Math.round(seconds);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
}

interface DashboardMetricsCardsProps {
  summary: DashboardSummary;
}

export function DashboardMetricsCards({ summary }: DashboardMetricsCardsProps) {
  const successRateText = summary.success_rate != null ? `${summary.success_rate}%` : '—';
  const mttaText = formatDurationSeconds(summary.mtta_seconds);
  const mttrText = formatDurationSeconds(summary.mttr_seconds);

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      role="region"
      aria-label="Indicadores Operacionais"
    >
      {/* 1. Automações Ativas */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">Automações Ativas</span>
          <PlayCircle className="h-5 w-5 text-indigo-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-bold text-white" data-testid="metric-active-automations">
          {summary.active_automations}
        </div>
        <p className="text-xs text-zinc-400">Estado cadastral global</p>
      </div>

      {/* 2. Execuções */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">Execuções</span>
          <Activity className="h-5 w-5 text-sky-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-bold text-white" data-testid="metric-executions">
          {summary.executions}
        </div>
        <p className="text-xs text-zinc-400">Total iniciado no período</p>
      </div>

      {/* 3. Taxa de Sucesso */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">Taxa de Sucesso</span>
          <CheckCircle2
            className={`h-5 w-5 ${
              summary.success_rate != null && summary.success_rate >= 90
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}
            aria-hidden="true"
          />
        </div>
        <div
          className={`text-2xl font-bold ${
            summary.success_rate != null && summary.success_rate >= 90
              ? 'text-emerald-300'
              : summary.success_rate != null
                ? 'text-amber-300'
                : 'text-zinc-400'
          }`}
          data-testid="metric-success-rate"
        >
          {successRateText}
        </div>
        <p className="text-xs text-zinc-400">
          {summary.success_rate != null
            ? 'Exclui execuções em andamento'
            : 'Sem execuções concluídas no período'}
        </p>
      </div>

      {/* 4. Falhas e Timeouts */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">Falhas & Timeouts</span>
          <AlertTriangle
            className={`h-5 w-5 ${summary.failures > 0 ? 'text-rose-400' : 'text-zinc-500'}`}
            aria-hidden="true"
          />
        </div>
        <div
          className={`text-2xl font-bold ${
            summary.failures > 0 ? 'text-rose-300' : 'text-zinc-300'
          }`}
          data-testid="metric-failures"
        >
          {summary.failures}
        </div>
        <p className="text-xs text-zinc-400">Status FAILED ou TIMEOUT</p>
      </div>

      {/* 5. Incidentes Abertos */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">Incidentes Abertos</span>
          <AlertOctagon
            className={`h-5 w-5 ${summary.open_incidents > 0 ? 'text-orange-400' : 'text-emerald-400'}`}
            aria-hidden="true"
          />
        </div>
        <div
          className={`text-2xl font-bold ${
            summary.open_incidents > 0 ? 'text-orange-300' : 'text-emerald-300'
          }`}
          data-testid="metric-open-incidents"
        >
          {summary.open_incidents}
        </div>
        <p className="text-xs text-zinc-400">Backlog ativo não resolvido</p>
      </div>

      {/* 6. MTTA */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">
            MTTA (Reconhecimento)
          </span>
          <Clock className="h-5 w-5 text-indigo-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-bold text-white" data-testid="metric-mtta">
          {mttaText}
        </div>
        <p className="text-xs text-zinc-400">
          {summary.mtta_seconds != null
            ? 'Tempo médio de abertura a aceite'
            : 'Sem incidentes reconhecidos no período'}
        </p>
      </div>

      {/* 7. MTTR */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-zinc-400">
          <span className="text-xs font-medium uppercase tracking-wider">MTTR (Resolução)</span>
          <Timer className="h-5 w-5 text-emerald-400" aria-hidden="true" />
        </div>
        <div className="text-2xl font-bold text-white" data-testid="metric-mttr">
          {mttrText}
        </div>
        <p className="text-xs text-zinc-400">
          {summary.mttr_seconds != null
            ? 'Tempo médio de abertura a resolução'
            : 'Sem incidentes resolvidos no período'}
        </p>
      </div>
    </div>
  );
}
