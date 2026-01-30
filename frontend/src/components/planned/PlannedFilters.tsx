interface PlannedFiltersProps {
  filterStatus: 'ALL' | 'UNPAID' | 'PAID';
  setFilterStatus: (status: 'ALL' | 'UNPAID' | 'PAID') => void;
}

/**
 * Componente filtri specifico per transazioni pianificate
 */
export default function PlannedFilters({
  filterStatus,
  setFilterStatus,
}: PlannedFiltersProps) {
  return (
    <div className="card card-md mb-6">
      <div className="flex flex-wrap gap-2 sm:gap-4">
        <button
          onClick={() => setFilterStatus('UNPAID')}
          className={`btn-filter flex-1 sm:flex-initial ${
            filterStatus === 'UNPAID' ? 'bg-warning-600 text-white' : 'btn-filter-inactive'
          }`}
        >
          Da Pagare
        </button>
        <button
          onClick={() => setFilterStatus('PAID')}
          className={`btn-filter flex-1 sm:flex-initial ${
            filterStatus === 'PAID' ? 'btn-filter-income-active' : 'btn-filter-inactive'
          }`}
        >
          Pagate
        </button>
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`btn-filter flex-1 sm:flex-initial ${
            filterStatus === 'ALL' ? 'btn-filter-all-active' : 'btn-filter-inactive'
          }`}
        >
          Tutte
        </button>
      </div>
    </div>
  );
}
