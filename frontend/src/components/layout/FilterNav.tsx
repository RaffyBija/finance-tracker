import SearchBar from "./SearchBar";

interface FilterNavProps {
    filterType?: 'ALL' | 'INCOME' | 'EXPENSE';
    setFilterType: (type: 'ALL' | 'INCOME' | 'EXPENSE') => void;
    setSearchFilter: (type:string)=> void;
}


export default function FilterNav({    
    filterType,
    setFilterType,
    setSearchFilter
}: FilterNavProps) {
    return (
         <div className="bg-white rounded-lg shadow p-4 mb-6 grid grid-cols-5 grid-rows-1 gap-4">
        
        <div className="flex gap-4">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2 shadow rounded-lg ${filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Tutte
          </button>
          <button
            onClick={() => setFilterType('INCOME')}
            className={`px-4 py-2 shadow rounded-lg ${filterType === 'INCOME' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
          >
            Entrate
          </button>
          <button
            onClick={() => setFilterType('EXPENSE')}
            className={`px-4 py-2 shadow rounded-lg ${filterType === 'EXPENSE' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
          >
            Uscite
          </button>
        </div>
        <div className="col-start-7">
        <SearchBar
          setSearchFilter={(value)=>setSearchFilter(value)}
        ></SearchBar>
        </div>
      </div> 
    );
}
