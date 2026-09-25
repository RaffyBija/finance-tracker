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
    <div className="card card-md planned-filters-card">
      <div className="planned-filters-row">
        <button
          onClick={() => setFilterStatus('UNPAID')}
          className={`btn-filter btn-filter-grow ${
            filterStatus === 'UNPAID' ? 'btn-filter-warning-active' : 'btn-filter-inactive'
          }`}
        >
          Da Pagare
        </button>
        <button
          onClick={() => setFilterStatus('PAID')}
          className={`btn-filter btn-filter-grow ${
            filterStatus === 'PAID' ? 'btn-filter-income-active' : 'btn-filter-inactive'
          }`}
        >
          Pagate
        </button>
        <button
          onClick={() => setFilterStatus('ALL')}
          className={`btn-filter btn-filter-grow ${
            filterStatus === 'ALL' ? 'btn-filter-all-active' : 'btn-filter-inactive'
          }`}
        >
          Tutte
        </button>
      </div>
    </div>
  );
}
