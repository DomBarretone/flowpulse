import React from 'react';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" data-testid="dashboard-skeleton">
      {/* Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
            <div className="h-3 w-24 bg-zinc-800 rounded" />
            <div className="h-8 w-16 bg-zinc-700/60 rounded" />
            <div className="h-2.5 w-32 bg-zinc-800/80 rounded" />
          </div>
        ))}
      </div>

      {/* Chart Skeleton */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 w-48 bg-zinc-800 rounded" />
          <div className="h-4 w-32 bg-zinc-800 rounded" />
        </div>
        <div className="h-48 w-full bg-zinc-800/30 rounded" />
      </div>

      {/* Distributions Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <div className="h-4 w-40 bg-zinc-800 rounded" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-full bg-zinc-800/50 rounded" />
                <div className="h-2 w-full bg-zinc-800/80 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
          <div className="h-4 w-40 bg-zinc-800 rounded" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-full bg-zinc-800/50 rounded" />
                <div className="h-2 w-full bg-zinc-800/80 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
        <div className="h-4 w-52 bg-zinc-800 rounded" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 w-full bg-zinc-800/40 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
