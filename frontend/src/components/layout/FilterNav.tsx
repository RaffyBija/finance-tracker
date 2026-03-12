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
    <div className="card card-md mb-6">
      {/* Riga 1: filtri tipo + ricerca */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex gap-2 sm:gap-4">
          <button
            onClick={() => setFilterType('ALL')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterType === 'ALL' ? 'btn-filter-all-active' : 'btn-filter-inactive'
            }`}
          >
            Tutte
          </button>
          <button
            onClick={() => setFilterType('INCOME')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterType === 'INCOME' ? 'btn-filter-income-active' : 'btn-filter-inactive'
            }`}
          >
            Entrate
          </button>
          <button
            onClick={() => setFilterType('EXPENSE')}
            className={`btn-filter flex-1 sm:flex-initial ${
              filterType === 'EXPENSE' ? 'btn-filter-expense-active' : 'btn-filter-inactive'
            }`}
          >
            Uscite
          </button>
        </div>
        <div className="w-full sm:w-auto">
          <SearchBar setSearchFilter={(value) => setSearchFilter(value)} />
        </div>
      </div>

      {/* Riga 2: filtro date (solo se setDateRange è passato) */}
      {setDateRange && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center mt-3 pt-3 border-t border-neutral-100">
          <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide self-center whitespace-nowrap">
            Periodo
          </span>
          <div className="flex gap-2 flex-1 items-center">
            <input
              type="date"
              value={dateRange?.startDate ?? ''}
              onChange={handleStartDate}
              max={dateRange?.endDate || undefined}
              className="form-input flex-1 text-sm h-9"
              placeholder="Da"
            />
            <span className="text-neutral-400 text-sm flex-shrink-0">→</span>
            <input
              type="date"
              value={dateRange?.endDate ?? ''}
              onChange={handleEndDate}
              min={dateRange?.startDate || undefined}
              className="form-input flex-1 text-sm h-9"
              placeholder="A"
            />
            {hasDateFilter && (
              <button
                onClick={handleClearDates}
                className="btn-icon-neutral flex-shrink-0"
                title="Rimuovi filtro date"
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