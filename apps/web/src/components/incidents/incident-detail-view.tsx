'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Loader2,
  Search,
  Sparkles,
  User,
} from 'lucide-react';
import {
  acknowledgeIncident,
  AiAnalysis,
  getIncident,
  getIncidentAiAnalyses,
  getIncidentEvents,
  IncidentDetail,
  IncidentEvent,
  investigateIncident,
  requestAiAnalysis,
  resolveIncident,
} from '../../lib/api/incidents';
import { getCurrentUser, UserProfile } from '../../lib/api/users';
import { IncidentStatusBadge } from './incident-status-badge';
import { IncidentSeverityBadge } from './incident-severity-badge';
import { IncidentTimeline } from './incident-timeline';
import { AiAnalysisCard } from './ai-analysis-card';
import { ResolveIncidentModal } from './resolve-incident-modal';

interface IncidentDetailViewProps {
  incidentId: string;
}

export function IncidentDetailView({ incidentId }: IncidentDetailViewProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const resolveBtnRef = useRef<HTMLButtonElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setGeneralError(null);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sessão não autenticada.');
      }

      const [inc, evts, ans, user] = await Promise.all([
        getIncident(token, incidentId),
        getIncidentEvents(token, incidentId),
        getIncidentAiAnalyses(token, incidentId),
        getCurrentUser(token),
      ]);

      setIncident(inc);
      setEvents(evts);
      setAnalyses(ans);
      setCurrentUser(user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setGeneralError(err.message);
      } else {
        setGeneralError('Falha ao carregar os detalhes do incidente.');
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, incidentId]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setGeneralError('Sessão não autenticada.');
      setLoading(false);
      return;
    }
    loadData();
  }, [isLoaded, isSignedIn, loadData]);

  // Ação: Assumir Incidente (OPEN -> ACKNOWLEDGED)
  const handleAcknowledge = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setGeneralError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão não autenticada.');

      await acknowledgeIncident(token, incidentId);
      await loadData();
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Falha ao assumir o incidente.');
    } finally {
      setActionLoading(false);
    }
  };

  // Ação: Iniciar Investigação (ACKNOWLEDGED -> INVESTIGATING)
  const handleInvestigate = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setGeneralError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão não autenticada.');

      await investigateIncident(token, incidentId);
      await loadData();
    } catch (err: unknown) {
      setGeneralError(err instanceof Error ? err.message : 'Falha ao iniciar a investigação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Ação: Analisar com IA
  const handleRequestAi = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setAiError(null);
    setGeneralError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão não autenticada.');

      await requestAiAnalysis(token, incidentId);
      await loadData();
    } catch {
      // 503 ou erro do OpenRouter é tratado amigavelmente sem bloquear a tela
      setAiError(
        'O serviço de inteligência artificial está temporariamente indisponível. Você pode prosseguir normalmente com a análise e resolução manual do incidente.',
      );
    } finally {
      setActionLoading(false);
    }
  };

  // Ação: Confirmar Resolução (INVESTIGATING -> RESOLVED)
  const handleConfirmResolve = async (notes: string) => {
    setActionLoading(true);
    setGeneralError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sessão não autenticada.');

      await resolveIncident(token, incidentId, notes);
      setIsResolveModalOpen(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        data-testid="incident-detail-loading"
        className="p-20 flex flex-col items-center justify-center space-y-3 text-zinc-400"
      >
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" aria-hidden="true" />
        <p className="text-sm font-medium">Carregando detalhes do incidente...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="text-red-400 text-sm font-semibold">
          {generalError || 'Incidente não encontrado.'}
        </p>
        <Link
          href="/incidents"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para a fila de incidentes</span>
        </Link>
      </div>
    );
  }

  const isAssignedToCurrentUser = currentUser ? incident.assigned_to_id === currentUser.id : false;
  const isAdmin = currentUser?.role === 'ADMIN';
  const canOperate = isAdmin || isAssignedToCurrentUser;

  return (
    <div className="space-y-8" data-testid="incident-detail-view">
      {/* Barra de Navegação e Topo */}
      <div>
        <Link
          href="/incidents"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1 mb-4"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Voltar para a Fila de Incidentes</span>
        </Link>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-lg">
                ID: {incident.id}
              </span>
              <IncidentSeverityBadge severity={incident.severity} />
              <IncidentStatusBadge status={incident.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{incident.automation.name}</span>
            </h1>
          </div>

          {/* Barra de Ações Contextuais */}
          <div className="flex flex-wrap items-center gap-3">
            {incident.status === 'OPEN' && (
              <button
                onClick={handleAcknowledge}
                disabled={actionLoading}
                data-testid="btn-acknowledge"
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-amber-950/40 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Clock className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Assumir Incidente</span>
              </button>
            )}

            {incident.status === 'ACKNOWLEDGED' && canOperate && (
              <button
                onClick={handleInvestigate}
                disabled={actionLoading}
                data-testid="btn-investigate"
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-950/40 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Search className="w-4 h-4" aria-hidden="true" />
                )}
                <span>Iniciar Investigação</span>
              </button>
            )}

            {incident.status === 'INVESTIGATING' && canOperate && (
              <>
                <button
                  onClick={handleRequestAi}
                  disabled={actionLoading}
                  data-testid="btn-request-ai"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-950/40 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>Analisar com IA</span>
                </button>

                <button
                  ref={resolveBtnRef}
                  onClick={() => setIsResolveModalOpen(true)}
                  disabled={actionLoading}
                  data-testid="btn-resolve"
                  className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-950/40 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>Resolver Incidente</span>
                </button>
              </>
            )}

            {incident.status === 'RESOLVED' && (
              <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-400" aria-hidden="true" />
                Incidente Concluído
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {generalError && (
        <div
          className="p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs flex items-center gap-2"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{generalError}</span>
        </div>
      )}

      {aiError && (
        <div
          data-testid="ai-error-banner"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center justify-between gap-3"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{aiError}</span>
          </div>
          <button
            onClick={() => setAiError(null)}
            className="text-amber-400 hover:text-amber-200 font-semibold underline text-xs"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* Metadados e Informações Operacionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            <User className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            <span>Responsável Atribuído</span>
          </div>
          {incident.assigned_to ? (
            <div>
              <p className="text-sm font-semibold text-white">{incident.assigned_to.name}</p>
              <p className="text-xs text-zinc-400">{incident.assigned_to.email}</p>
            </div>
          ) : (
            <p className="text-xs text-zinc-500 italic">Nenhum operador atribuído</p>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            <Clock className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            <span>Timestamps Operacionais</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Aberto:</span>
              <span className="font-mono text-zinc-300">
                {new Date(incident.opened_at).toLocaleTimeString('pt-BR')}
              </span>
            </div>
            {incident.acknowledged_at && (
              <div className="flex justify-between text-zinc-400">
                <span>Assumido:</span>
                <span className="font-mono text-zinc-300">
                  {new Date(incident.acknowledged_at).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            )}
            {incident.investigating_at && (
              <div className="flex justify-between text-zinc-400">
                <span>Investigando:</span>
                <span className="font-mono text-zinc-300">
                  {new Date(incident.investigating_at).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            )}
            {incident.resolved_at && (
              <div className="flex justify-between text-emerald-400">
                <span>Resolvido:</span>
                <span className="font-mono">
                  {new Date(incident.resolved_at).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800">
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            <Layers className="w-4 h-4 text-zinc-500" aria-hidden="true" />
            <span>Execução Primária</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>ID Externo:</span>
              <span className="font-mono text-zinc-300 truncate max-w-[120px]">
                {incident.execution?.external_execution_id || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-zinc-400">
              <span>Duração:</span>
              <span className="font-mono text-zinc-300">
                {incident.execution?.duration_ms ? `${incident.execution.duration_ms}ms` : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mensagem de Erro Sanitizada da Execução */}
      {incident.execution?.error_message && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-red-400" aria-hidden="true" />
              <span>Log de Erro da Execução (Sanitizado)</span>
            </h3>
            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded font-mono">
              Segredos expurgados com [REDACTED]
            </span>
          </div>
          <pre
            data-testid="sanitized-error-log"
            className="p-4 rounded-xl bg-black/80 border border-zinc-800/80 text-xs font-mono text-red-300 overflow-x-auto whitespace-pre-wrap leading-relaxed"
          >
            {incident.execution.error_message}
          </pre>
        </div>
      )}

      {/* Notas de Resolução (se RESOLVED) */}
      {incident.status === 'RESOLVED' && incident.resolution_notes && (
        <div
          data-testid="resolved-notes-section"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 space-y-2"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Notas Explicativas de Resolução</span>
          </h3>
          <p className="text-sm text-zinc-200 bg-zinc-950/60 p-4 rounded-xl border border-emerald-500/20 whitespace-pre-wrap font-sans leading-relaxed">
            {incident.resolution_notes}
          </p>
        </div>
      )}

      {/* Seção de Diagnósticos da IA */}
      {analyses.length > 0 && (
        <section aria-labelledby="ai-analysis-heading">
          <h2 id="ai-analysis-heading" className="sr-only">
            Diagnósticos da IA
          </h2>
          <AiAnalysisCard analyses={analyses} />
        </section>
      )}

      {/* Seção de Linha do Tempo de Eventos */}
      <section
        aria-labelledby="timeline-heading"
        className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2
            id="timeline-heading"
            className="text-base font-bold text-white flex items-center gap-2"
          >
            <Clock className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <span>Linha do Tempo e Trilha de Auditoria</span>
          </h2>
          <span className="text-xs text-zinc-500 font-mono">{events.length} evento(s)</span>
        </div>

        <IncidentTimeline events={events} />
      </section>

      {/* Modal de Resolução */}
      <ResolveIncidentModal
        isOpen={isResolveModalOpen}
        onClose={() => {
          setIsResolveModalOpen(false);
          resolveBtnRef.current?.focus();
        }}
        onConfirm={handleConfirmResolve}
        isSubmitting={actionLoading}
      />
    </div>
  );
}
