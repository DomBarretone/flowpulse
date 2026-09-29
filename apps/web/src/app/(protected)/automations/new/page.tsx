'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { ArrowLeft, Cpu, AlertTriangle, Loader2 } from 'lucide-react';
import { Criticality, createAutomation } from '../../../../lib/api/automations';

export default function NewAutomationPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criticality, setCriticality] = useState<Criticality>('MEDIUM');
  const [expectedDuration, setExpectedDuration] = useState('60');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'O nome da automação é obrigatório.';
    }

    const durationNum = parseInt(expectedDuration, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      newErrors.expectedDuration =
        'A duração esperada deve ser um número inteiro estritamente positivo (> 0).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const created = await createAutomation(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        criticality,
        expected_duration_seconds: parseInt(expectedDuration, 10),
      });

      router.push(`/automations/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao cadastrar automação.';
      setApiError(msg);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/automations"
          className="inline-flex items-center text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1.5 py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          Voltar para Automações
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 md:p-8 space-y-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            <span>Cadastrar Nova Automação</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Configure os parâmetros de monitoramento operacional. A automação será criada em estado
            de Rascunho (DRAFT) com integração pendente de teste.
          </p>
        </div>

        {apiError && (
          <div
            role="alert"
            data-testid="api-error-alert"
            className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-red-200 flex items-start space-x-3"
          >
            <AlertTriangle
              className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-sm font-semibold">Erro ao salvar automação</h2>
              <p className="text-xs text-red-300 mt-1">{apiError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Nome */}
          <div className="space-y-1.5">
            <label htmlFor="name-input" className="block text-xs font-medium text-zinc-200">
              Nome da Automação <span className="text-red-400">*</span>
            </label>
            <input
              id="name-input"
              data-testid="automation-name-input"
              type="text"
              required
              aria-required="true"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'name-error' : undefined}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sync de Pedidos ERP SAP"
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {errors.name && (
              <p id="name-error" className="text-xs text-red-400" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label htmlFor="description-input" className="block text-xs font-medium text-zinc-200">
              Descrição Sucinta <span className="text-zinc-500">(opcional)</span>
            </label>
            <textarea
              id="description-input"
              data-testid="automation-description-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito, gatilho e impacto no negócio..."
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Criticidade & Duração Esperada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="criticality-select"
                className="block text-xs font-medium text-zinc-200"
              >
                Criticidade Operacional <span className="text-red-400">*</span>
              </label>
              <select
                id="criticality-select"
                data-testid="automation-criticality-select"
                value={criticality}
                onChange={(e) => setCriticality(e.target.value as Criticality)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LOW">Baixa (LOW)</option>
                <option value="MEDIUM">Média (MEDIUM)</option>
                <option value="HIGH">Alta (HIGH)</option>
                <option value="CRITICAL">Crítica (CRITICAL)</option>
              </select>
              <p className="text-[11px] text-zinc-400">
                Determina deterministicamente a severidade de incidentes em caso de falha.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="duration-input" className="block text-xs font-medium text-zinc-200">
                Duração Esperada (segundos) <span className="text-red-400">*</span>
              </label>
              <input
                id="duration-input"
                data-testid="automation-duration-input"
                type="number"
                min="1"
                step="1"
                required
                aria-required="true"
                aria-invalid={!!errors.expectedDuration}
                aria-describedby={errors.expectedDuration ? 'duration-error' : undefined}
                value={expectedDuration}
                onChange={(e) => setExpectedDuration(e.target.value)}
                placeholder="60"
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.expectedDuration && (
                <p id="duration-error" className="text-xs text-red-400" role="alert">
                  {errors.expectedDuration}
                </p>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-zinc-800">
            <Link
              href="/automations"
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-md border border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              data-testid="submit-automation-button"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" aria-hidden="true" />
                  Salvando...
                </>
              ) : (
                'Salvar e Continuar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
