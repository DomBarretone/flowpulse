'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { AlertOctagon, ArrowRight, Filter, Loader2, RefreshCw, Search } from 'lucide-react';
import {
  IncidentItem,
  IncidentSeverity,
  IncidentStatus,
  listIncidents,
} from '../../../lib/api/incidents';
import { IncidentStatusBadge } from '../../../components/incidents/incident-status-badge';
import { IncidentSeverityBadge } from '../../../components/incidents/incident-severity-badge';

export default function IncidentsPage() {
  const { getToken } = useAuth();

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [page, setPage] = useState(1);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sessão não autenticada.');
      }

      const params: {
        status?: IncidentStatus;
        severity?: IncidentSeverity;
        page: number;
        limit: number;
      } = {
        page,
        limit: 20,
      };

      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus as IncidentStatus;
      }
      if (selectedSeverity !== 'ALL') {
        params.severity = selectedSeverity as IncidentSeverity;
      }

      const res = await listIncidents(token, params);
      setIncidents(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Falha ao carregar a lista de incidentes.');
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, page, selectedStatus, selectedSeverity]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <AlertOctagon className="h-6 w-6 text-red-400" aria-hidden="true" />
            <span>Fila Operacional de Incidentes</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Tratamento de falhas, ciclo de vida operacional e diagnóstico assistido por IA.
          </p>
        </div>

        <button
          onClick={() => fetchIncidents()}
          disabled={loading}
          data-testid="refresh-button"
          aria-label="Atualizar lista de incidentes"
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Barra de Filtros */}
      <div
        className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-4"
        aria-label="Filtros da tabela de incidentes"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase text-zinc-400">
            <Filter className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            <span>Filtrar por:</span>
          </div>

          {/* Filtro de Status */}
          <label htmlFor="filter-status" className="sr-only">
            Filtrar por Status
          </label>
          <select
            id="filter-status"
            data-testid="filter-status"
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">Todos os Status</option>
            <option value="OPEN">Abertos (OPEN)</option>
            <option value="ACKNOWLEDGED">Assumidos (ACKNOWLEDGED)</option>
            <option value="INVESTIGATING">Em Investigação (INVESTIGATING)</option>
            <option value="RESOLVED">Resolvidos (RESOLVED)</option>
          </select>

          {/* Filtro de Severidade */}
          <label htmlFor="filter-severity" className="sr-only">
            Filtrar por Severidade
          </label>
          <select
            id="filter-severity"
            data-testid="filter-severity"
            value={selectedSeverity}
            onChange={(e) => {
              setSelectedSeverity(e.target.value);
              setPage(1);
            }}
            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            <option value="ALL">Todas as Severidades</option>
            <option value="CRITICAL">Crítica (CRITICAL)</option>
            <option value="HIGH">Alta (HIGH)</option>
            <option value="MEDIUM">Média (MEDIUM)</option>
            <option value="LOW">Baixa (LOW)</option>
          </select>
        </div>

        <div className="text-xs text-zinc-500 font-mono">
          Total de ocorrências: <strong className="text-zinc-300">{total}</strong>
        </div>
      </div>

      {/* Erro de API */}
      {error && (
        <div
          data-testid="incidents-error-banner"
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm flex items-center justify-between"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => fetchIncidents()}
            className="underline hover:text-white font-semibold ml-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Tabela de Incidentes */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
        {loading ? (
          <div
            data-testid="incidents-loading"
            className="p-16 flex flex-col items-center justify-center space-y-3 text-zinc-400"
          >
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" aria-hidden="true" />
            <p className="text-sm font-medium">Carregando fila de incidentes...</p>
          </div>
        ) : incidents.length === 0 ? (
          <div
            data-testid="incidents-empty-state"
            className="p-16 text-center flex flex-col items-center justify-center space-y-3"
          >
            <div className="p-4 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
              <Search className="w-8 h-8" aria-hidden="true" />
            </div>
            <h2 className="text-base font-semibold text-zinc-200">Nenhum incidente encontrado</h2>
            <p className="text-xs text-zinc-400 max-w-sm">
              Não existem ocorrências abertas correspondentes aos filtros selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <th scope="col" className="px-6 py-3.5">
                    Severidade
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Automação
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Aberto em
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Responsável
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {incidents.map((incident) => {
                  const formattedDate = new Date(incident.opened_at).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  });

                  return (
                    <tr
                      key={incident.id}
                      data-testid={`incident-row-${incident.id}`}
                      className="hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IncidentSeverityBadge severity={incident.severity} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IncidentStatusBadge status={incident.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-white">{incident.automation.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-400 font-mono">
                        {formattedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {incident.assigned_to ? (
                          <span className="text-zinc-200 font-medium">
                            {incident.assigned_to.name}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic">Não atribuído</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link
                          href={`/incidents/${incident.id}`}
                          data-testid={`view-incident-${incident.id}`}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-indigo-600 text-xs font-semibold text-zinc-200 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <span>Detalhes</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
