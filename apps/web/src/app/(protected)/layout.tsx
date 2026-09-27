import React from 'react';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { UserButton } from '@clerk/nextjs';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  // auth.protect() redireciona automaticamente para /sign-in se não autenticado
  await auth.protect();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard"
            className="text-xl font-bold tracking-tight text-white hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
          >
            FlowPulse
          </Link>
          <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
            Console Operacional
          </span>
        </div>

        <nav className="flex items-center space-x-4" aria-label="Navegação do usuário">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
          >
            Dashboard
          </Link>
          <Link
            href="/automations"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-2 py-1"
          >
            Automações
          </Link>
          <div className="pl-2 border-l border-zinc-800">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: 'w-8 h-8 border border-zinc-700',
                  userButtonPopoverCard:
                    'bg-zinc-900 border border-zinc-800 text-zinc-100 shadow-xl',
                  userPreviewMainIdentifier: 'text-zinc-100 font-semibold',
                  userPreviewSecondaryIdentifier: 'text-zinc-400',
                  userButtonPopoverActionButton:
                    'text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800',
                  userButtonPopoverActionButtonIcon: 'text-zinc-400',
                  userButtonPopoverFooter: 'hidden',
                },
              }}
            />
          </div>
        </nav>
      </header>

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
    </div>
  );
}
