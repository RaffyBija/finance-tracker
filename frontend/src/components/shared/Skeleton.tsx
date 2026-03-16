interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const Skeleton = ({ className = '', style }: SkeletonProps) => (
  <div className={`animate-pulse bg-neutral-200 rounded-lg ${className}`} style={style} />
);

// Header pagina (titolo + bottone)
export const SkeletonPageHeader = () => (
  <div className="page-header">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-10 w-40 rounded-lg" />
  </div>
);

// Card con numero grande (usata nei summary della dashboard)
export const SkeletonStatCard = () => (
  <div className="card p-6 space-y-3">
    <div className="flex justify-between items-start">
      <div className="space-y-2 flex-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-10 w-10 rounded-full" />
    </div>
  </div>
);

// Grafico a barre o linee
export const SkeletonChart = () => (
  <div className="card p-6 space-y-4">
    <Skeleton className="h-4 w-32" />
    <div className="flex items-end gap-3 h-48">
      {[60, 85, 45, 70, 90, 55, 75].map((h, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
      ))}
    </div>
    <div className="flex justify-between">
      {[...Array(7)].map((_, i) => (
        <Skeleton key={i} className="h-3 w-8" />
      ))}
    </div>
  </div>
);

// Grafico a torta
export const SkeletonPieChart = () => (
  <div className="card p-6 flex items-center gap-6">
    <Skeleton className="h-40 w-40 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full flex-shrink-0" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  </div>
);

// Riga lista (transazioni, ricorrenti, pianificate)
export const SkeletonListItem = () => (
  <div className="flex items-center gap-4 p-4">
    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/4" />
    </div>
    <div className="text-right space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-3 w-14" />
    </div>
  </div>
);

// Lista completa (N righe)
export const SkeletonList = ({ rows = 5 }: { rows?: number }) => (
  <div className="list-card divide-y divide-neutral-100">
    {[...Array(rows)].map((_, i) => (
      <SkeletonListItem key={i} />
    ))}
  </div>
);

// Card generica (budget, categorie)
export const SkeletonCard = () => (
  <div className="card p-6 space-y-4">
    <div className="flex justify-between items-start">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
    <Skeleton className="h-3 w-full rounded-full" />
    <div className="flex justify-between">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

// Grid di card (categorie, budget)
export const SkeletonCardGrid = ({ cols = 3, rows = 2 }: { cols?: number; rows?: number }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
    {[...Array(cols * rows)].map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default Skeleton;