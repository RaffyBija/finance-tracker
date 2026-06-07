import SearchBar from "./SearchBar";
import { X } from "lucide-react";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface FilterNavProps {
  filterType?: 'ALL' | 'INCOME' | 'EXPENSE';
  setFilterType: (type: 'ALL' | 'INCOME' | 'EXPENSE') => void;
  setSearchFilter: (value: string) => void;
  // Props opzionali per filtro date (solo TransactionsPage)
  dateRange?: DateRange;
  setDateRange?: (range: DateRange) => void;
}

export default function FilterNav({
  filterType,
  setFilterType,
  setSearchFilter,
  dateRange,
  setDateRange,
}: FilterNavProps) {
  const hasDateFilter = !!(dateRange?.startDate || dateRange?.endDate);

  const handleClearDates = () => {
    setDateRange?.({ startDate: '', endDate: '' });
  };

  const handleStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange?.({ startDate: e.target.value, endDate: dateRange?.endDate ?? '' });
  };

  const handleEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateRange?.({ startDate: dateRange?.startDate ?? '', endDate: e.target.value });
  };

  return (
    <div className="card card-md filter-bar">
      {/* Riga 1: filtri tipo + ricerca */}
      <div className="filter-bar-row">
        <div className="filter-types">
          <button
            onClick={() => setFilterType('ALL')}
            className={`btn-filter ${
              filterType === 'ALL' ? 'btn-filter-all-active' : 'btn-filter-inactive'
            }`}
          >
            Tutte
          </button>
          <button
            onClick={() => setFilterType('INCOME')}
            className={`btn-filter ${
              filterType === 'INCOME' ? 'btn-filter-income-active' : 'btn-filter-inactive'
            }`}
          >
            Entrate
          </button>
          <button
            onClick={() => setFilterType('EXPENSE')}
            className={`btn-filter ${
              filterType === 'EXPENSE' ? 'btn-filter-expense-active' : 'btn-filter-inactive'
            }`}
          >
            Uscite
          </button>
        </div>
        <div className="filter-search">
          <SearchBar setSearchFilter={(value) => setSearchFilter(value)} />
        </div>
      </div>

      {/* Riga 2: filtro date (solo se setDateRange è passato) */}
      {setDateRange && (
        <div className="filter-period">
          <span className="filter-period-label">
            Periodo
          </span>
          <div className="filter-date-range">
            <input
              type="date"
              value={dateRange?.startDate ?? ''}
              onChange={handleStartDate}
              max={dateRange?.endDate || undefined}
              className="form-input"
              placeholder="Da"
            />
            <span className="filter-date-range-sep">→</span>
            <input
              type="date"
              value={dateRange?.endDate ?? ''}
              onChange={handleEndDate}
              min={dateRange?.startDate || undefined}
              className="form-input"
              placeholder="A"
            />
            {hasDateFilter && (
              <button
                onClick={handleClearDates}
                className="btn-icon-neutral"
                title="Rimuovi filtro date"
                aria-label="Rimuovi filtro date"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}