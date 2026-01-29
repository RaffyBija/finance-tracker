import SearchBar from "./SearchBar";

interface FilterNavProps {
    filterType?: 'ALL' | 'INCOME' | 'EXPENSE';
    setFilterType: (type: 'ALL' | 'INCOME' | 'EXPENSE') => void;
    setSearchFilter: (type: string) => void;
}

export default function FilterNav({    
    filterType,
    setFilterType,
    setSearchFilter
}: FilterNavProps) {
    return (
        <div className="card card-md mb-6">
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
        </div> 
    );
}