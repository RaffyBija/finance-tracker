import { useEffect, useState } from 'react';
import { categoryAPI } from '../api/client';
import type { Category, TransactionType } from '../types/index';
import { Plus } from 'lucide-react' 

import FilterNav from '../components/layout/FilterNav';
import CategoriesModal from '../components/categories/CategoriesModal';
import CategoriesCard from '../components/categories/CategoriesCard';

import matchesFilters from '../utils/filters.ts'

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [searchFilter, setFilterSearch] = useState('');
  const [refreshFeed, setRefreshFeed] = useState(false);
  useEffect(() => {
    loadCategories();
    setRefreshFeed(false);
  }, [refreshFeed]);

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro? Le transazioni associate non verranno eliminate.')) return;
    try {
      await categoryAPI.delete(id);
      loadCategories();
    } catch (error) {
      alert('Errore nell\'eliminazione');
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const loadCategories = async () => {
    try {
      setIsLoading(true);
      const data = await categoryAPI.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const handleOpenModal = () => {
    setShowModal(true);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <>
    <div className="px-4 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Categorie</h1>
        <button
          onClick={handleOpenModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nuova Categoria
        </button>
      </div>

      {/* Filtri */}
      <FilterNav
        filterType={filterType}
        setFilterType={setFilterType}
        setSearchFilter={setFilterSearch}
      />

      {/* Grid categorie */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            Nessuna categoria trovata
          </div>
        ) : (
          categories.map((category) => {            
            //Filtro 
                    if (
                      !matchesFilters(category, {
                        typeValue: filterType,
                        itemType: (t) => t.type,
                        searchValue: searchFilter,
                        searchFields: [
                          (t) => t.name,
                        ],
                      })
                    )
                return null;
            return (
              <CategoriesCard
                category = {category}
                handleEdit={() => handleEdit(category)}
                handleDelete={() => handleDelete(category.id)}
                />
            )
          })
        )}
      </div>
        </div>
        {/* Modal */}
        <CategoriesModal
            isOpen={showModal}
            onClose={()=>{setShowModal(false); setEditingCategory(null)}}
            sentFeed={()=>{setRefreshFeed(true)}}
            editingCategory={editingCategory}
        />
        
        </>
  );
}