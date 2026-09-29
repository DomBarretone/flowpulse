'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import {
  ArrowLeft,
  Key,
  ShieldAlert,
  Copy,
  Check,
  Play,
  Pause,
  AlertTriangle,
  Clock,
  Terminal,
  RotateCw,
  Trash2,
  Lock,
} from 'lucide-react';
import {
  Automation,
  GeneratedApiKey,
  activateAutomation,
  deactivateAutomation,
  generateApiKey,
  revokeApiKey,
} from '../lib/api/automations';
import { ExecutionItem, getExecutions } from '../lib/api/executions';
import {
  AutomationStatusBadge,
  CriticalityBadge,
  ExecutionStatusBadge,
  IntegrationStatusBadge,
} from './status-badges';

interface AutomationDetailViewProps {
  initialAutomation: Automation;
  initialExecutions: ExecutionItem[];
  isAdmin: boolean;
}

export function AutomationDetailView({
  initialAutomation,
  initialExecutions,
  isAdmin,
}: AutomationDetailViewProps) {
  const { getToken } = useAuth();

  const [automation, setAutomation] = useState<Automation>(initialAutomation);
  const [executions, setExecutions] = useState<ExecutionItem[]>(initialExecutions);

  // Estado estritamente volátil em memória para o segredo retornado uma única vez
  const [volatileSecret, setVolatileSecret] = useState<GeneratedApiKey | null>(null);
  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isRefreshingExecutions, setIsRefreshingExecutions] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const generateKeyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const secretInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (volatileSecret) {
      secretInputRef.current?.focus();
    }
  }, [volatileSecret]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (volatileSecret) {
          setVolatileSecret(null);
          setCopiedSecret(false);
          generateKeyTriggerRef.current?.focus();
        } else if (showGenerateConfirm) {
          setShowGenerateConfirm(false);
          generateKeyTriggerRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [volatileSecret, showGenerateConfirm]);

  const handleGenerateKey = async () => {
    setActionError(null);
    setIsGeneratingKey(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Não autenticado');

      const generated = await generateApiKey(token, automation.id);
      // Armazena estritamente na variável de estado volátil da memória do React
      setVolatileSecret(generated);
      setShowGenerateConfirm(false);

      // Atualiza a lista de chaves na view (adicionando a nova chave mascarada)
      setAutomation((prev) => ({
        ...prev,
        api_keys: [
          {
            id: generated.id,
            prefix: generated.prefix,
            created_at: generated.created_at,
            revoked_at: null,
            last_used_at: null,
          },
          ...(prev.api_keys || []),
        ],
      }));
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Falha ao gerar credencial.');
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleCloseSecretModal = () => {
    // Descarta o segredo da memória do componente
    setVolatileSecret(null);
    setCopiedSecret(false);
    generateKeyTriggerRef.current?.focus();
  };

  const handleCopySecret = async () => {
    if (!volatileSecret) return;
    try {
      await navigator.clipboard.writeText(volatileSecret.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (
      !confirm('Deseja realmente revogar esta credencial? Ela deixará de funcionar imediatamente.')
    ) {
      return;
    }
    setActionError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Não autenticado');

      const revoked = await revokeApiKey(token, automation.id, keyId);
      setAutomation((prev) => ({
        ...prev,
        api_keys: (prev.api_keys || []).map((k) =>
          k.id === keyId ? { ...k, revoked_at: revoked.revoked_at } : k,
        ),
      }));
      setSuccessMessage('Credencial revogada com sucesso.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Falha ao revogar chave.');
    }
  };

  const handleActivate = async () => {
    setActionError(null);
    setIsActivating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Não autenticado');

      const updated = await activateAutomation(token, automation.id);
      setAutomation(updated);
      setSuccessMessage('Monitoramento ativado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Falha ao ativar automação.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setActionError(null);
    setIsDeactivating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Não autenticado');

      const updated = await deactivateAutomation(token, automation.id);
      setAutomation(updated);
      setSuccessMessage('Monitoramento desativado.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Falha ao desativar automação.');
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshingExecutions(true);
    try {
      const token = await getToken();
      if (!token) return;

      const [updatedAuto, newExecs] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/automations/${automation.id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ).then((r) => r.json()),
        getExecutions(token, { automation_id: automation.id }),
      ]);

      if (updatedAuto && updatedAuto.id) {
        setAutomation(updatedAuto);
      }
      setExecutions(newExecs);
    } catch {
      // ignore
    } finally {
      setIsRefreshingExecutions(false);
    }
  };

  const sampleApiKey = volatileSecret?.secret || 'fp_live_<SUA_CHAVE_DE_INTEGRACAO>';
  const curlSnippet = `curl -X POST ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/executions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${sampleApiKey}" \\
  -d '{
    "external_execution_id": "test-integration-001",
    "status": "SUCCESS",
    "started_at": "2026-09-27T19:00:00Z",
    "duration_ms": 1500,
    "is_test": true
  }'`;

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlSnippet);
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2500);
    } catch {
      // fallback
    }
  };

  const canActivate = automation.integration_status === 'VALIDATED';
  const isActive = automation.status === 'ACTIVE';

  return (
    <div className="space-y-8">
      {/* Navegação e Título */}
      <div className="space-y-3">
        <Link
          href="/automations"
          className="inline-flex items-center text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          Voltar para Automações
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">{automation.name}</h1>
              <AutomationStatusBadge status={automation.status} />
              <IntegrationStatusBadge status={automation.integration_status} />
            </div>
            {automation.description && (
              <p className="text-sm text-zinc-400 mt-1">{automation.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshingExecutions}
              title="Atualizar status e execuções"
              className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <RotateCw
                className={`w-4 h-4 ${isRefreshingExecutions ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="sr-only">Atualizar</span>
            </button>

            {isAdmin && (
              <>
                {!isActive ? (
                  <div className="relative group">
                    <button
                      type="button"
                      data-testid="activate-automation-button"
                      disabled={!canActivate || isActivating}
                      onClick={handleActivate}
                      className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:border-zinc-700 text-white text-xs font-semibold rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
                      {isActivating ? 'Ativando...' : 'Ativar Monitoramento'}
                    </button>
                    {!canActivate && (
                      <div
                        data-testid="activation-blocked-tooltip"
                        className="hidden group-hover:block absolute right-0 top-full mt-2 w-64 p-2 bg-zinc-900 text-zinc-300 text-xs rounded border border-zinc-700 shadow-xl z-20"
                      >
                        A ativação requer o envio prévio de um evento de teste real (`is_test:
                        true`) validado com sucesso.
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="deactivate-automation-button"
                    disabled={isDeactivating}
                    onClick={handleDeactivate}
                    className="inline-flex items-center px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-md border border-zinc-700 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1.5 text-zinc-400" aria-hidden="true" />
                    {isDeactivating ? 'Desativando...' : 'Desativar Monitoramento'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alertas */}
      {actionError && (
        <div
          role="alert"
          data-testid="detail-error-alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-200 flex items-start space-x-3"
        >
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-medium">{actionError}</p>
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          data-testid="detail-success-alert"
          className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4 text-emerald-200 flex items-start space-x-3"
        >
          <Check className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-xs font-medium">{successMessage}</p>
        </div>
      )}

      {/* Grid de Parâmetros Operacionais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
          <span className="text-xs text-zinc-400">Criticidade</span>
          <div>
            <CriticalityBadge criticality={automation.criticality} />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
          <span className="text-xs text-zinc-400">Duração Esperada</span>
          <div className="text-base font-semibold text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            <span>{automation.expected_duration_seconds} segundos</span>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
          <span className="text-xs text-zinc-400">Status Operacional</span>
          <div>
            <AutomationStatusBadge status={automation.status} />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-1">
          <span className="text-xs text-zinc-400">Integração da API</span>
          <div>
            <IntegrationStatusBadge status={automation.integration_status} />
          </div>
        </div>
      </div>

      {/* Modal / Card de Revelação One-Time do Segredo */}
      {volatileSecret && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="secret-modal-title"
          data-testid="volatile-secret-modal"
          className="rounded-lg border-2 border-amber-500/40 bg-zinc-900 p-6 shadow-2xl space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 text-amber-400">
              <Lock className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <h2 id="secret-modal-title" className="text-base font-semibold">
                Credencial de Integração Gerada (Exibição Única)
              </h2>
            </div>
            <button
              type="button"
              onClick={handleCloseSecretModal}
              data-testid="close-secret-modal-button"
              className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Fechar e Descartar da Tela
            </button>
          </div>

          <div
            role="alert"
            className="text-xs text-amber-200 bg-amber-950/30 p-3 rounded border border-amber-900/50"
          >
            <strong>Atenção:</strong> Copie esta chave agora. Por segurança, o backend armazena
            apenas o hash criptográfico SHA-256 e o segredo completo{' '}
            <strong>nunca mais poderá ser exibido</strong> após o fechamento desta janela.
          </div>

          <div className="space-y-2">
            <label htmlFor="volatile-secret-value" className="text-xs text-zinc-400">
              Chave de API (`x-api-key`):
            </label>
            <div className="flex items-center space-x-2">
              <input
                ref={secretInputRef}
                id="volatile-secret-value"
                data-testid="volatile-secret-input"
                type="text"
                readOnly
                value={volatileSecret.secret}
                className="flex-1 font-mono text-xs bg-zinc-950 text-emerald-400 p-2.5 rounded border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
              <button
                type="button"
                data-testid="copy-secret-button"
                onClick={handleCopySecret}
                className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {copiedSecret ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-300" aria-hidden="true" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1.5" aria-hidden="true" />
                    Copiar Chave
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação Prévia para Geração de Chave */}
      {showGenerateConfirm && !volatileSecret && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          data-testid="generate-confirm-modal"
          className="rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl space-y-4"
        >
          <div className="flex items-center space-x-2 text-zinc-100">
            <Key className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h2 id="confirm-modal-title" className="text-sm font-semibold">
              Gerar Nova Credencial de Integração
            </h2>
          </div>
          <p className="text-xs text-zinc-300">
            Uma nova chave de 256 bits com prefixo <code className="text-indigo-300">fp_live_</code>{' '}
            será emitida. Você deverá copiá-la imediatamente, pois ela não será salva em texto
            plano.
          </p>
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => setShowGenerateConfirm(false)}
              className="px-3 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              data-testid="confirm-generate-key-button"
              disabled={isGeneratingKey}
              onClick={handleGenerateKey}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              {isGeneratingKey ? 'Gerando...' : 'Confirmar e Gerar'}
            </button>
          </div>
        </div>
      )}

      {/* Seção de Credenciais de Integração */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-indigo-400" aria-hidden="true" />
              <span>Credenciais de Integração (API Keys)</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Chaves de máquina dedicadas para ingestão segura de execuções via cabeçalho{' '}
              <code className="text-zinc-300">x-api-key</code>.
            </p>
          </div>

          {isAdmin && (
            <button
              ref={generateKeyTriggerRef}
              type="button"
              data-testid="generate-key-button"
              onClick={() => setShowGenerateConfirm(true)}
              className="inline-flex items-center px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-md border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Key className="w-3.5 h-3.5 mr-1.5 text-indigo-400" aria-hidden="true" />
              Gerar Chave de Integração
            </button>
          )}
        </div>

        {/* Tabela de Chaves */}
        {!automation.api_keys || automation.api_keys.length === 0 ? (
          <p data-testid="no-keys-message" className="text-xs text-zinc-500 italic py-2">
            Nenhuma chave de integração gerada para esta automação. Gere uma chave para autenticar
            seu pipeline.
          </p>
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-md">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    Prefixo Público
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Criada em
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Último Uso
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Status
                  </th>
                  {isAdmin && (
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Ação
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 font-mono">
                {automation.api_keys.map((k) => {
                  const isRevoked = !!k.revoked_at;
                  return (
                    <tr key={k.id} data-testid={`key-row-${k.id}`} className="hover:bg-zinc-800/20">
                      <td className="px-4 py-3 text-zinc-200 font-semibold">{k.prefix}...</td>
                      <td className="px-4 py-3 font-sans text-zinc-400">
                        {new Date(k.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 font-sans text-zinc-400">
                        {k.last_used_at
                          ? new Date(k.last_used_at).toLocaleString('pt-BR')
                          : 'Nunca utilizada'}
                      </td>
                      <td className="px-4 py-3 font-sans">
                        {isRevoked ? (
                          <span
                            data-testid={`key-status-revoked-${k.id}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-300 border border-red-500/30"
                          >
                            Revogada
                          </span>
                        ) : (
                          <span
                            data-testid={`key-status-active-${k.id}`}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                          >
                            Ativa
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 font-sans text-right">
                          {!isRevoked && (
                            <button
                              type="button"
                              data-testid={`revoke-key-button-${k.id}`}
                              onClick={() => handleRevokeKey(k.id)}
                              className="inline-flex items-center text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded hover:bg-red-950/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                              Revogar
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guia cURL de Teste de Integração (Fluxo 1) */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-indigo-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">
              Teste Real da Integração (Validação Pré-Ativação)
            </h2>
          </div>
          <button
            type="button"
            data-testid="copy-curl-button"
            onClick={handleCopyCurl}
            className="inline-flex items-center px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded transition-colors"
          >
            {copiedCurl ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" aria-hidden="true" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                Copiar cURL
              </>
            )}
          </button>
        </div>

        <p className="text-xs text-zinc-300">
          Execute este comando em seu terminal ou pipeline. Ao receber a requisição de teste com
          sucesso (<code className="text-indigo-300">is_test: true</code>), a automação transitará
          automaticamente para o estado <strong>Integração Validada</strong>, liberando a ativação
          do monitoramento produtivo.
        </p>

        <div className="relative">
          <pre
            data-testid="curl-snippet-block"
            className="p-4 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-xs overflow-x-auto leading-relaxed"
          >
            {curlSnippet}
          </pre>
        </div>
      </div>

      {/* Tabela de Execuções Recentes */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Histórico Recente de Execuções</h2>
          <span className="text-xs text-zinc-400">{executions.length} execuções registradas</span>
        </div>

        {executions.length === 0 ? (
          <p data-testid="no-executions-message" className="text-xs text-zinc-500 italic py-4">
            Nenhuma execução registrada para esta automação. Dispare o comando de teste acima para
            começar.
          </p>
        ) : (
          <div className="overflow-x-auto border border-zinc-800 rounded-md">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    ID Externo
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Tipo
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Duração
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Data/Hora
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    Incidente
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {executions.map((exec) => (
                  <tr
                    key={exec.id}
                    data-testid={`execution-row-${exec.id}`}
                    className="hover:bg-zinc-800/20"
                  >
                    <td className="px-4 py-3 font-mono text-zinc-200">
                      {exec.external_execution_id}
                    </td>
                    <td className="px-4 py-3">
                      <ExecutionStatusBadge status={exec.status} />
                    </td>
                    <td className="px-4 py-3">
                      {exec.is_test ? (
                        <span
                          data-testid="execution-test-badge"
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30"
                        >
                          Teste
                        </span>
                      ) : (
                        <span
                          data-testid="execution-prod-badge"
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
                        >
                          Produção
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-400">
                      {exec.duration_ms !== null && exec.duration_ms !== undefined
                        ? `${exec.duration_ms}ms`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">
                      {new Date(exec.started_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {exec.incident ? (
                        <span
                          data-testid={`execution-incident-badge-${exec.id}`}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-red-500/10 text-red-300 border border-red-500/30"
                        >
                          <ShieldAlert className="w-3 h-3 mr-1 text-red-400" aria-hidden="true" />
                          Incidente Aberto
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
