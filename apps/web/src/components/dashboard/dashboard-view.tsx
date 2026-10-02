'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import {
  DashboardMetricsResponse,
  DashboardPeriod,
  fetchDashboardMetrics,
} from '../../lib/api/dashboard';
import { DashboardMetricsCards } from './dashboard-metrics-cards';
import { ExecutionSeriesChart } from './execution-series-chart';
import { IncidentSeverityDistribution, IncidentStatusDistribution } from './incidents-distribution';
import { RecentIncidentsTable } from './recent-incidents-table';
import { DashboardSkeleton } from './dashboard-skeleton';

const VALID_PERIODS: DashboardPeriod[] = ['24h', '7d', '30d'];

export function DashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const urlPeriod = searchParams.get('period') as DashboardPeriod | null;
  const initialPeriod: DashboardPeriod =
    urlPeriod && VALID_PERIODS.includes(urlPeriod) ? urlPeriod : '7d';

  const [period, setPeriod] = useState<DashboardPeriod>(initialPeriod);
  const [metrics, setMetrics] = useState<DashboardMetricsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadMetrics = useCallback(
    async (selectedPeriod: DashboardPeriod) => {
      // Aborta requisições pendentes anteriores para evitar race condition
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);

      try {
        const token = await getToken();
        if (!token) {
          throw new Error('Sessão não autenticada no provedor de identidade.');
        }

        const data = await fetchDashboardMetrics(token, selectedPeriod, controller.signal);
        setMetrics(data);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Falha ao carregar métricas operacionais.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [getToken],
  );

  // Sincroniza estado com query string da URL
  useEffect(() => {
    const currentParam = searchParams.get('period') as DashboardPeriod | null;
    const validated = currentParam && VALID_PERIODS.includes(currentParam) ? currentParam : '7d';

    if (validated !== period) {
      setPeriod(validated);
      if (isLoaded && isSignedIn) {
        loadMetrics(validated);
      }
    }
  }, [searchParams, period, isLoaded, isSignedIn, loadMetrics]);

  // Carregamento inicial condicionado à prontidão do Clerk
  useEffect(() => {
    if (!isLoaded) {
      // Enquanto o Clerk ainda não terminou de hidratar/restaurar sessão,
      // preserva o skeleton de carregamento sem disparar requisição prematura
      return;
    }

    if (!isSignedIn) {
      // Usuário comprovadamente não autenticado após prontidão do Clerk
      setError('Sessão não autenticada no provedor de identidade.');
      setLoading(false);
      return;
    }

    loadMetrics(period);
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isLoaded, isSignedIn, loadMetrics, period]);

  const handlePeriodChange = (newPeriod: DashboardPeriod) => {
    // Bloqueia cliques repetidos no período já ativo ou enquanto autenticação não está pronta
    if (newPeriod === period || loading || !isLoaded || !isSignedIn) return;

    setPeriod(newPeriod);
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', newPeriod);
    router.push(`/dashboard?${params.toString()}`);
    loadMetrics(newPeriod);
  };

  const handleRefresh = () => {
    if (!loading && isLoaded && isSignedIn) {
      loadMetrics(period);
    }
  };

  return (
    <main className="space-y-6" role="main" aria-label="Dashboard Operacional">
      {/* Cabeçalho do Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Operacional</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Visão consolidada da saúde das automações, volume de execuções e gestão de incidentes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Períodos */}
          <div
            className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900/80 p-1"
            role="group"
            aria-label="Selecionar período de análise"
          >
            <button
              type="button"
              data-testid="period-btn-24h"
              disabled={period === '24h' || loading}
              onClick={() => handlePeriodChange('24h')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                period === '24h'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              } disabled:opacity-75 disabled:cursor-not-allowed`}
            >
              24 Horas
            </button>
            <button
              type="button"
              data-testid="period-btn-7d"
              disabled={period === '7d' || loading}
              onClick={() => handlePeriodChange('7d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                period === '7d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              } disabled:opacity-75 disabled:cursor-not-allowed`}
            >
              7 Dias
            </button>
            <button
              type="button"
              data-testid="period-btn-30d"
              disabled={period === '30d' || loading}
              onClick={() => handlePeriodChange('30d')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                period === '30d'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              } disabled:opacity-75 disabled:cursor-not-allowed`}
            >
              30 Dias
            </button>
          </div>

          {/* Botão de Atualizar Dados */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Atualizar dados do dashboard"
            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* Timestamp de Atualização */}
      {metrics && !loading && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            Última atualização:{' '}
            <time dateTime={metrics.generated_at}>
              {new Date(metrics.generated_at).toLocaleString('pt-BR')}
            </time>
          </span>
          <span className="font-mono text-zinc-400">Janela ativa: {period}</span>
        </div>
      )}

      {/* Estado de Erro RFC 7807 */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-5 text-zinc-200 space-y-3"
          data-testid="dashboard-error-alert"
        >
          <div className="flex items-center space-x-3 text-red-400">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-semibold">Falha ao carregar métricas operacionais</h2>
          </div>
          <p className="text-xs text-zinc-300">{error}</p>
          <div className="pt-1">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium rounded-md border border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Skeleton durante Loading */}
      {loading && <DashboardSkeleton />}

      {/* Conteúdo Principal com Dados Carregados */}
      {!loading && metrics && (
        <div className="space-y-6">
          {/* Grade com os 7 Cards Principais */}
          <DashboardMetricsCards summary={metrics.summary} />

          {/* Gráfico de Série Temporal de Execuções */}
          <ExecutionSeriesChart series={metrics.execution_series} period={metrics.period} />

          {/* Distribuição por Status e por Severidade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <IncidentStatusDistribution distribution={metrics.incidents_by_status} />
            <IncidentSeverityDistribution distribution={metrics.open_incidents_by_severity} />
          </div>

          {/* Fila de Incidentes Recentes Prioritários */}
          <RecentIncidentsTable incidents={metrics.recent_incidents} />
        </div>
      )}
    </main>
  );
}
