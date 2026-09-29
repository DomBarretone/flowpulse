import React from 'react';
import { Clock, Search, Sparkles, CheckCircle2, AlertCircle, User } from 'lucide-react';
import { IncidentEvent } from '../../lib/api/incidents';

export function IncidentTimeline({ events }: { events: IncidentEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div
        data-testid="timeline-empty"
        className="p-6 text-center text-sm text-zinc-500 bg-zinc-900/40 rounded-xl border border-zinc-800/80"
      >
        Nenhum evento registrado nesta linha do tempo.
      </div>
    );
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ACKNOWLEDGED':
        return <Clock className="w-4 h-4 text-amber-400" aria-hidden="true" />;
      case 'INVESTIGATION_STARTED':
        return <Search className="w-4 h-4 text-blue-400" aria-hidden="true" />;
      case 'AI_ANALYSIS_REQUESTED':
        return <Sparkles className="w-4 h-4 text-purple-400" aria-hidden="true" />;
      case 'AI_ANALYSIS_COMPLETED':
        return <Sparkles className="w-4 h-4 text-indigo-400" aria-hidden="true" />;
      case 'RESOLVED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />;
      default:
        return <AlertCircle className="w-4 h-4 text-zinc-400" aria-hidden="true" />;
    }
  };

  const getEventTitle = (eventType: string) => {
    switch (eventType) {
      case 'ACKNOWLEDGED':
        return 'Incidente Assumido';
      case 'INVESTIGATION_STARTED':
        return 'Investigação Iniciada';
      case 'AI_ANALYSIS_REQUESTED':
        return 'Análise de IA Solicitada';
      case 'AI_ANALYSIS_COMPLETED':
        return 'Análise de IA Concluída';
      case 'RESOLVED':
        return 'Incidente Resolvido';
      default:
        return eventType;
    }
  };

  return (
    <div
      role="region"
      data-testid="incident-timeline"
      className="flow-root"
      aria-label="Linha do tempo de eventos do incidente"
    >
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const isLast = idx === events.length - 1;
          const formattedDate = new Date(event.created_at).toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'medium',
          });

          return (
            <li key={event.id} data-testid={`timeline-event-${event.event_type}`}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-zinc-800"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 shadow-sm ring-4 ring-zinc-950">
                    {getEventIcon(event.event_type)}
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-zinc-100">
                        {getEventTitle(event.event_type)}
                      </p>
                      <time dateTime={event.created_at} className="text-xs text-zinc-500 font-mono">
                        {formattedDate}
                      </time>
                    </div>
                    <div className="mt-1 flex items-center space-x-2 text-xs text-zinc-400">
                      <User className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                      <span>{event.actor?.name || 'Sistema / Operador'}</span>
                      {event.actor?.email && (
                        <span className="text-zinc-600">({event.actor.email})</span>
                      )}
                    </div>
                    {event.note && (
                      <div className="mt-2 text-xs text-zinc-300 bg-zinc-900/80 border border-zinc-800 p-2.5 rounded-lg whitespace-pre-wrap font-sans">
                        {event.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
