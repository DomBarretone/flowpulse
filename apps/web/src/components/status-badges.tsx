import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
  ShieldAlert,
  Info,
  PauseCircle,
  FileEdit,
  Loader2,
} from 'lucide-react';
import { AutomationStatus, Criticality, IntegrationStatus } from '../lib/api/automations';
import { ExecutionStatus } from '../lib/api/executions';

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  switch (status) {
    case 'ACTIVE':
      return (
        <span
          data-testid="status-badge-active"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" aria-hidden="true" />
          Ativa
        </span>
      );
    case 'INACTIVE':
      return (
        <span
          data-testid="status-badge-inactive"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700"
        >
          <PauseCircle className="w-3.5 h-3.5 mr-1 text-zinc-400" aria-hidden="true" />
          Inativa
        </span>
      );
    case 'DRAFT':
    default:
      return (
        <span
          data-testid="status-badge-draft"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700"
        >
          <FileEdit className="w-3.5 h-3.5 mr-1 text-zinc-400" aria-hidden="true" />
          Rascunho
        </span>
      );
  }
}

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  switch (status) {
    case 'VALIDATED':
      return (
        <span
          data-testid="integration-badge-validated"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" aria-hidden="true" />
          Integração Validada
        </span>
      );
    case 'FAILED':
      return (
        <span
          data-testid="integration-badge-failed"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/30"
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-red-400" aria-hidden="true" />
          Falha na Integração
        </span>
      );
    case 'PENDING':
    default:
      return (
        <span
          data-testid="integration-badge-pending"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30"
        >
          <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" aria-hidden="true" />
          Pendente de Teste
        </span>
      );
  }
}

export function CriticalityBadge({ criticality }: { criticality: Criticality }) {
  switch (criticality) {
    case 'CRITICAL':
      return (
        <span
          data-testid="criticality-badge-critical"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/30"
        >
          <ShieldAlert className="w-3.5 h-3.5 mr-1 text-red-400" aria-hidden="true" />
          Crítica
        </span>
      );
    case 'HIGH':
      return (
        <span
          data-testid="criticality-badge-high"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/30"
        >
          <AlertCircle className="w-3.5 h-3.5 mr-1 text-orange-400" aria-hidden="true" />
          Alta
        </span>
      );
    case 'MEDIUM':
      return (
        <span
          data-testid="criticality-badge-medium"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30"
        >
          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-400" aria-hidden="true" />
          Média
        </span>
      );
    case 'LOW':
    default:
      return (
        <span
          data-testid="criticality-badge-low"
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/30"
        >
          <Info className="w-3.5 h-3.5 mr-1 text-sky-400" aria-hidden="true" />
          Baixa
        </span>
      );
  }
}

export function ExecutionStatusBadge({ status }: { status: ExecutionStatus }) {
  switch (status) {
    case 'SUCCESS':
      return (
        <span
          data-testid="execution-badge-success"
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
        >
          <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" aria-hidden="true" />
          Sucesso
        </span>
      );
    case 'FAILED':
      return (
        <span
          data-testid="execution-badge-failed"
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-300 border border-red-500/30"
        >
          <AlertTriangle className="w-3 h-3 mr-1 text-red-400" aria-hidden="true" />
          Falha
        </span>
      );
    case 'TIMEOUT':
      return (
        <span
          data-testid="execution-badge-timeout"
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-300 border border-orange-500/30"
        >
          <Clock className="w-3 h-3 mr-1 text-orange-400" aria-hidden="true" />
          Timeout
        </span>
      );
    case 'RUNNING':
    default:
      return (
        <span
          data-testid="execution-badge-running"
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-500/10 text-sky-300 border border-sky-500/30"
        >
          <Loader2 className="w-3 h-3 mr-1 text-sky-400 animate-spin" aria-hidden="true" />
          Em Execução
        </span>
      );
  }
}
