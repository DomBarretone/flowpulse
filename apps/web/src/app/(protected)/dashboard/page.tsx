import React from 'react';
import { auth } from '@clerk/nextjs/server';
import { SignOutButton } from '@clerk/nextjs';
import {
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Mail,
  Fingerprint,
  Calendar,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export interface PersistedUser {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ANALYST';
  created_at: string;
  updated_at: string;
}

async function fetchCurrentUser(
  token: string | null,
): Promise<{ user?: PersistedUser; error?: string }> {
  if (!token) {
    return { error: 'Token de autenticação ausente na sessão ativa do Clerk.' };
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

  try {
    const res = await fetch(`${apiUrl}/users/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errorText = await res.text();
      let detail = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.detail) {
          detail = parsed.detail;
        }
      } catch {
        // fallback to status
      }
      return { error: detail };
    }

    const user = (await res.json()) as PersistedUser;
    return { user };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro de conexão';
    return { error: `Não foi possível conectar ao backend (${apiUrl}): ${msg}` };
  }
}

export default async function DashboardPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const { user, error } = await fetchCurrentUser(token);

  if (error || !user) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Operacional</h1>
          <p className="text-sm text-zinc-400">Verificação de identidade e credenciais de acesso</p>
        </div>

        <div
          role="alert"
          className="rounded-lg border border-red-500/30 bg-red-950/20 p-6 text-zinc-200 space-y-4"
        >
          <div className="flex items-center space-x-3 text-red-400">
            <AlertTriangle className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
            <h2 className="text-base font-semibold">
              Falha ao carregar perfil persistido no backend
            </h2>
          </div>
          <p className="text-sm text-zinc-300">
            A API de autenticação não pôde ser consultada para validar a fonte autoritativa de
            dados.
          </p>
          <div className="bg-zinc-950/60 rounded p-3 border border-red-900/40 text-xs font-mono text-red-300">
            {error || 'Dados de usuário indisponíveis'}
          </div>
          <div className="pt-2">
            <SignOutButton redirectUrl="/">
              <button
                type="button"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-md border border-zinc-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Encerrar Sessão
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Operacional</h1>
          <p className="text-sm text-zinc-400">
            Identidade do usuário sincronizada e autorizada pelo PostgreSQL via NestJS
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <SignOutButton redirectUrl="/">
            <button
              type="button"
              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium rounded-md border border-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Encerrar Sessão
            </button>
          </SignOutButton>
        </div>
      </div>

      {/* Identidade e Permissão Autoritativa do Banco */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card do Papel (RBAC) */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Papel Autoritativo
            </span>
            {isAdmin ? (
              <ShieldCheck className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            ) : (
              <UserCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span
                data-testid="user-role-badge"
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  isAdmin
                    ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                    : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isAdmin ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                    ADMIN
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                    ANALYST
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Origem: <span className="font-mono text-zinc-300">PostgreSQL (Prisma ORM)</span>
            </p>
          </div>
        </div>

        {/* Card de Identidade do Usuário */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Identidade Principal
            </span>
            <Mail className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <div>
            <p data-testid="user-email" className="text-sm font-semibold text-white break-all">
              {user.email}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Nome: {user.name}</p>
          </div>
        </div>

        {/* Card de Segurança & Clerk ID */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Sessão Clerk (IdP)
            </span>
            <Fingerprint className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          </div>
          <div>
            <p
              data-testid="clerk-user-id"
              className="text-xs font-mono text-zinc-300 break-all bg-zinc-950/70 p-1.5 rounded border border-zinc-800"
            >
              {user.clerk_user_id}
            </p>
            <p className="text-xs text-zinc-400 mt-2 flex items-center">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mr-1" aria-hidden="true" />
              Sessão validada criptograficamente
            </p>
          </div>
        </div>
      </div>

      {/* Detalhes de Auditoria do Usuário */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center space-x-2">
          <KeyRound className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          <span>Metadados da Conta Persistida</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-300">
          <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">ID Interno (UUID):</span>
            <span data-testid="user-internal-id" className="text-zinc-200">
              {user.id}
            </span>
          </div>
          <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800/80">
            <span className="text-zinc-500 block mb-1">Criado em:</span>
            <span className="text-zinc-200 flex items-center">
              <Calendar className="h-3.5 w-3.5 mr-1 text-zinc-400" aria-hidden="true" />
              {new Date(user.created_at).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
