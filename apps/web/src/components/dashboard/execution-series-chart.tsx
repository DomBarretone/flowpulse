import React, { useState } from 'react';
import { ExecutionSeriesBucket, DashboardPeriod } from '../../lib/api/dashboard';
import { BarChart3, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface ExecutionSeriesChartProps {
  series: ExecutionSeriesBucket[];
  period: DashboardPeriod;
}

export function ExecutionSeriesChart({ series, period }: ExecutionSeriesChartProps) {
  const [activeBucket, setActiveBucket] = useState<ExecutionSeriesBucket | null>(null);

  const totalAll = series.reduce((acc, b) => acc + b.total, 0);
  const totalSuccess = series.reduce((acc, b) => acc + b.success, 0);
  const totalFailed = series.reduce((acc, b) => acc + b.failed, 0);
  const totalTimeout = series.reduce((acc, b) => acc + b.timeout, 0);

  if (totalAll === 0) {
    return (
      <div
        className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col items-center justify-center min-h-[260px] text-center space-y-3"
        data-testid="execution-series-empty"
      >
        <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
          <BarChart3 className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-zinc-300">
          Nenhuma execução registrada na janela de {period}
        </p>
        <p className="text-xs text-zinc-500 max-w-sm">
          Assim que automações enviarem relatórios de execução, a evolução temporal do volume e
          confiabilidade será traçada aqui.
        </p>
      </div>
    );
  }

  const maxBucketTotal = Math.max(...series.map((b) => b.total), 1);
  const chartHeight = 180;
  const paddingX = 20;
  const chartWidth = Math.max(series.length * 28, 500);

  const formatBucketLabel = (isoString: string) => {
    const d = new Date(isoString);
    if (period === '24h') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
  };

  return (
    <div
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6 space-y-4"
      role="region"
      aria-label={`Série temporal de execuções no período ${period}. Total de ${totalAll} execuções, sendo ${totalSuccess} com sucesso, ${totalFailed} falhas e ${totalTimeout} timeouts.`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" aria-hidden="true" />
            <span>Volume e Confiabilidade de Execuções</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Distribuição temporal categorizada por sucesso, falha e timeout
          </p>
        </div>

        {/* Legenda Acessível */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>Sucesso ({totalSuccess})</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>Falha ({totalFailed})</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
            <span>Timeout ({totalTimeout})</span>
          </div>
        </div>
      </div>

      {/* Detalhe do Bucket Ativo (Tooltip / Card Dinâmico) */}
      <div
        className="min-h-[32px] px-3 py-1.5 rounded bg-zinc-950/70 border border-zinc-800 text-xs text-zinc-300 flex flex-wrap items-center justify-between"
        data-testid="chart-active-tooltip"
      >
        {activeBucket ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold text-white">
              {new Date(activeBucket.timestamp).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: period === '24h' ? 'short' : undefined,
              })}
            </span>
            <span className="text-zinc-400">
              Total: <strong className="text-zinc-100">{activeBucket.total}</strong>
            </span>
            <span className="text-emerald-400">
              Sucesso: <strong>{activeBucket.success}</strong>
            </span>
            <span className="text-rose-400">
              Falhas: <strong>{activeBucket.failed}</strong>
            </span>
            <span className="text-amber-400">
              Timeouts: <strong>{activeBucket.timeout}</strong>
            </span>
          </div>
        ) : (
          <span className="text-zinc-500 italic">
            Passe o mouse ou selecione uma coluna para inspecionar os valores pontuais
          </span>
        )}
      </div>

      {/* Gráfico SVG Responsivo com Scroll Horizontal se necessário */}
      <div className="overflow-x-auto pb-2">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}
          className="w-full h-56 select-none"
          role="img"
          aria-label="Gráfico de barras de execuções ao longo do tempo"
        >
          {/* Linhas de Grade de Fundo */}
          <line
            x1="0"
            y1={chartHeight}
            x2={chartWidth}
            y2={chartHeight}
            stroke="#27272a"
            strokeWidth="1"
          />
          <line
            x1="0"
            y1={chartHeight / 2}
            x2={chartWidth}
            y2={chartHeight / 2}
            stroke="#27272a"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Barras Verticais Empilhadas */}
          {series.map((bucket, index) => {
            const availableWidth = chartWidth - paddingX * 2;
            const step = availableWidth / series.length;
            const barWidth = Math.max(step * 0.6, 6);
            const x = paddingX + index * step + (step - barWidth) / 2;

            const scale = chartHeight / maxBucketTotal;
            const successH = bucket.success * scale;
            const failedH = bucket.failed * scale;
            const timeoutH = bucket.timeout * scale;
            const runningH =
              Math.max(0, bucket.total - bucket.success - bucket.failed - bucket.timeout) * scale;

            let currentY = chartHeight;

            const successY = currentY - successH;
            currentY = successY;

            const failedY = currentY - failedH;
            currentY = failedY;

            const timeoutY = currentY - timeoutH;
            currentY = timeoutY;

            const runningY = currentY - runningH;

            const isHovered = activeBucket?.timestamp === bucket.timestamp;

            return (
              <g
                key={bucket.timestamp}
                className="cursor-pointer transition-opacity focus:outline-none"
                tabIndex={0}
                onMouseEnter={() => setActiveBucket(bucket)}
                onFocus={() => setActiveBucket(bucket)}
                aria-label={`${formatBucketLabel(bucket.timestamp)}: ${bucket.total} execuções (${bucket.success} sucesso, ${bucket.failed} falha, ${bucket.timeout} timeout)`}
              >
                {/* Highlight de fundo */}
                {isHovered && (
                  <rect
                    x={paddingX + index * step}
                    y="0"
                    width={step}
                    height={chartHeight + 30}
                    fill="#3f3f46"
                    opacity="0.15"
                    rx="4"
                  />
                )}

                {/* Segmento Running / Transitório */}
                {runningH > 0 && (
                  <rect
                    x={x}
                    y={runningY}
                    width={barWidth}
                    height={runningH}
                    fill="#38bdf8"
                    rx="1"
                  />
                )}

                {/* Segmento Timeout */}
                {timeoutH > 0 && (
                  <rect
                    x={x}
                    y={timeoutY}
                    width={barWidth}
                    height={timeoutH}
                    fill="#f59e0b"
                    rx="1"
                  />
                )}

                {/* Segmento Failed */}
                {failedH > 0 && (
                  <rect x={x} y={failedY} width={barWidth} height={failedH} fill="#f43f5e" rx="1" />
                )}

                {/* Segmento Success */}
                {successH > 0 && (
                  <rect
                    x={x}
                    y={successY}
                    width={barWidth}
                    height={successH}
                    fill="#10b981"
                    rx="1"
                  />
                )}

                {/* Barra vazia zero (indicador) */}
                {bucket.total === 0 && (
                  <circle cx={x + barWidth / 2} cy={chartHeight - 2} r="1.5" fill="#52525b" />
                )}

                {/* Rótulo de Data no eixo X (amostrado para não sobrepor) */}
                {(series.length <= 12 ||
                  index % Math.ceil(series.length / 10) === 0 ||
                  index === series.length - 1) && (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight + 18}
                    textAnchor="middle"
                    fill="#a1a1aa"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {formatBucketLabel(bucket.timestamp)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
