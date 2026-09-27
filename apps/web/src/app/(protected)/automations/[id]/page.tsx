import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '../../../../lib/api/users';
import { getAutomation, Automation } from '../../../../lib/api/automations';
import { getExecutions, ExecutionItem } from '../../../../lib/api/executions';
import { AutomationDetailView } from '../../../../components/automation-detail-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AutomationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return (
      <div className="space-y-4">
        <Link
          href="/automations"
          className="inline-flex items-center text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar
        </Link>
        <div
          role="alert"
          className="p-4 bg-red-950/20 border border-red-500/30 rounded text-red-200"
        >
          Sessão não autenticada.
        </div>
      </div>
    );
  }

  const user = await getCurrentUser(token);
  const isAdmin = user?.role === 'ADMIN';

  let automation: Automation | null = null;
  let executions: ExecutionItem[] = [];
  let error: string | null = null;

  try {
    const [fetchedAuto, fetchedExecs] = await Promise.all([
      getAutomation(token, id),
      getExecutions(token, { automation_id: id }),
    ]);
    automation = fetchedAuto;
    executions = fetchedExecs;
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : 'Falha ao buscar detalhes da automação';
  }

  if (!automation && !error) {
    notFound();
  }

  if (error || !automation) {
    return (
      <div className="space-y-4">
        <Link
          href="/automations"
          className="inline-flex items-center text-xs text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Voltar para Automações
        </Link>
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-red-200 flex items-start space-x-3"
        >
          <AlertTriangle className="h-6 w-6 text-red-400 flex-shrink-0" />
          <div>
            <h2 className="text-base font-semibold">Não foi possível carregar a automação</h2>
            <p className="text-xs text-red-300 mt-1">{error || 'Automação não encontrada'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AutomationDetailView
      initialAutomation={automation}
      initialExecutions={executions}
      isAdmin={isAdmin}
    />
  );
}
