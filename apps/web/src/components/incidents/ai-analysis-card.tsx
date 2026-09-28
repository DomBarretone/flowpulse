import React from 'react';
import {
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  ArrowRight,
  Cpu,
  Clock,
} from 'lucide-react';
import { AiAnalysis } from '../../lib/api/incidents';

export function AiAnalysisCard({ analyses }: { analyses: AiAnalysis[] }) {
  if (!analyses || analyses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6" data-testid="ai-analyses-container">
      {analyses.map((analysis, index) => {
        const isLatest = index === 0;
        const confidencePercent = Math.round(Number(analysis.confidence) * 100);
        const formattedDate = new Date(analysis.created_at).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'medium',
        });

        return (
          <div
            key={analysis.id}
            data-testid={`ai-analysis-card-${index}`}
            className={`rounded-2xl border ${
              isLatest
                ? 'border-indigo-500/40 bg-zinc-900/90 shadow-xl shadow-indigo-950/20'
                : 'border-zinc-800 bg-zinc-900/50'
            } p-6 relative overflow-hidden`}
          >
            {/* Header com rotulagem consultiva explícita */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Sparkles className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    Análise assistida por IA
                    <span className="text-xs bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                      Consultiva
                    </span>
                    {isLatest && (
                      <span className="text-xs bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                        Mais Recente
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center space-x-3 text-xs text-zinc-400 mt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Cpu className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                      {analysis.model}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
                      {formattedDate}
                    </span>
                  </div>
                </div>
              </div>

              {/* Indicador de Confiança */}
              <div
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800"
                aria-label={`Grau de confiança da IA: ${confidencePercent}%`}
              >
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    Confiança
                  </div>
                  <div className="text-sm font-bold text-indigo-300 font-mono">
                    {confidencePercent}%
                  </div>
                </div>
                <div className="w-12 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Aviso Obrigatório de Caráter Consultivo */}
            <div
              className="mt-4 flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed"
              role="note"
            >
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p>
                <strong>Aviso Consultivo:</strong> A análise é consultiva e deve ser validada pelo
                analista. A IA nunca altera status de incidentes ou executa ações em produção.
              </p>
            </div>

            {/* Resumo Diagnóstico */}
            <div className="mt-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                Resumo Diagnóstico
              </h4>
              <p className="text-sm text-zinc-200 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80 leading-relaxed font-sans">
                {analysis.summary}
              </p>
            </div>

            {/* Causas Prováveis */}
            {analysis.likely_causes && analysis.likely_causes.length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-indigo-400" aria-hidden="true" />
                  Causas Prováveis Identificadas
                </h4>
                <div className="space-y-2.5">
                  {analysis.likely_causes.map((causeItem, cIdx) => (
                    <div
                      key={cIdx}
                      className="p-3.5 rounded-xl bg-zinc-950/40 border border-zinc-800 text-sm"
                    >
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        {causeItem.cause}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 pl-3.5 leading-relaxed">
                        {causeItem.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grid: Evidências e Próximos Passos */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Evidências */}
              {analysis.evidence && analysis.evidence.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                    Evidências Extraídas dos Logs
                  </h4>
                  <ul className="space-y-1.5 text-xs text-zinc-300">
                    {analysis.evidence.map((ev, eIdx) => (
                      <li key={eIdx} className="flex items-start gap-2">
                        <span className="text-zinc-500 shrink-0">•</span>
                        <span className="font-mono text-[11px] text-zinc-300 break-all">{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Próximos Passos Recomendados */}
              {analysis.next_steps && analysis.next_steps.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
                    Próximos Passos Diagnósticos
                  </h4>
                  <ol className="space-y-2 text-xs text-zinc-300">
                    {analysis.next_steps.map((step, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {sIdx + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
