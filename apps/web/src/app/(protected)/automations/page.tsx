import React from 'react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Plus, Cpu, ArrowRight, AlertTriangle, Layers } from 'lucide-react';
import { getCurrentUser } from '../../../lib/api/users';
import { getAutomations, Automation } from '../../../lib/api/automations';
import {
  AutomationStatusBadge,
  IntegrationStatusBadge,
  CriticalityBadge,
} from '../../../components/status-badges';

export default async function AutomationsPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const user = await getCurrentUser(token);
  const isAdmin = user?.role === 'ADMIN';

  let automations: Automation[] = [];
  let error: string | null = null;

  if (!token) {
    error = 'Sessão não autenticada.';
  } else {
    try {
      automations = await getAutomations(token);
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : 'Falha ao carregar automações.';
    }
  }

  return (
    <main className="space-y-6" role="main" aria-label="Automações Monitoradas">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="h-6 w-6 text-indigo-400" aria-hidden="true" />
            <span>Automações Monitoradas</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Gerenciamento do ciclo de vida, credenciais e saúde de integrações do FlowPulse.
          </p>
        </div>

        {isAdmin ? (
          <Link
            href="/automations/new"
            data-testid="create-automation-button"
            className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
          >
            <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
            Nova Automação
          </Link>
        ) : (
          <span
            data-testid="analyst-read-only-badge"
            className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-md flex items-center"
          >
            Modo Leitura (Perfil Analista)
          </span>
        )}
      </div>

      {/* Alerta de Erro */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-200 flex items-start space-x-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold">Erro ao carregar automações</h2>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Estado Vazio ou Tabela */}
      {!error && automations.length === 0 ? (
        <div
          data-testid="empty-automations-state"
          className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 p-12 text-center"
        >
          <Layers className="mx-auto h-12 w-12 text-zinc-600" aria-hidden="true" />
          <h2 className="mt-4 text-base font-medium text-zinc-200">Nenhuma automação cadastrada</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Cadastre sua primeira automação para gerar credenciais de integração e monitorar
            execuções.
          </p>
          {isAdmin && (
            <div className="mt-6">
              <Link
                href="/automations/new"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Cadastrar Automação
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm text-zinc-300"
              aria-label="Tabela de automações monitoradas"
            >
              <thead className="bg-zinc-900/80 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th scope="col" className="px-6 py-3.5">
                    Nome e Descrição
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Criticidade
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Estado Operacional
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Integração
                  </th>
                  <th scope="col" className="px-6 py-3.5">
                    Duração Esperada
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {automations.map((auto) => (
                  <tr
                    key={auto.id}
                    data-testid={`automation-row-${auto.id}`}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{auto.name}</div>
                      {auto.description && (
                        <div className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                          {auto.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <CriticalityBadge criticality={auto.criticality} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <AutomationStatusBadge status={auto.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <IntegrationStatusBadge status={auto.integration_status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-zinc-400">
                      {auto.expected_duration_seconds}s
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link
                        href={`/automations/${auto.id}`}
                        data-testid={`view-details-${auto.id}`}
                        className="inline-flex items-center text-xs font-medium text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-2 py-1"
                      >
                        <span>Detalhes</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
