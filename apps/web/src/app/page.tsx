import React from 'react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-background text-text">
      <div className="w-full max-w-md p-6 rounded-lg border border-border bg-surface shadow-xl text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-white">FlowPulse</h1>
        <p className="text-text-muted text-sm">
          Sistema de monitoramento e acompanhamento de automações e pipelines
        </p>
        <div className="flex items-center justify-center space-x-2 pt-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-status-success"></span>
          </span>
          <span className="text-xs font-medium text-status-success">Application is running</span>
        </div>
      </div>
    </main>
  );
}
