import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-slate-200', className)} />;
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
