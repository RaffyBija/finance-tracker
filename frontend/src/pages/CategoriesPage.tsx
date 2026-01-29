import { useEffect, useState } from 'react';
import { categoryAPI } from '../api/client';
import type { Category, TransactionType } from '../types/index';
import { Plus } from 'lucide-react';
import FilterNav from '../components/layout/FilterNav';
import CategoriesModal from '../components/categories/CategoriesModal';
import CategoriesCard from '../components/categories/CategoriesCard';
import matchesFilters from '../utils/filters.ts';

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
    if (!confirm('Sei sicuro? Le transazioni associate non verranno eliminate.'))
      return;
    try {
      await categoryAPI.delete(id);
      loadCategories();
    } catch (error) {
      alert("Errore nell'eliminazione");
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
    return (
      <div className="flex-center h-64">
        <div className="skeleton skeleton-text w-32">Caricamento...</div>
      </div>
    );
  }

  return (
    <>
      <div className="container-custom">
        <div className="flex-between mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Categorie</h1>
          <button onClick={handleOpenModal} className="btn btn-primary btn-md">
            <Plus className="icon-md" />
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
            <div className="empty-state-card col-span-full">
              <p className="empty-state-title">Nessuna categoria trovata</p>
              <p className="empty-state-description">
                Crea la tua prima categoria per organizzare le transazioni
              </p>
              <button onClick={handleOpenModal} className="btn btn-primary btn-md">
                <Plus className="icon-md" />
                Crea Categoria
              </button>
            </div>
          ) : (
            categories.map((category) => {
              // Filtro
              if (
                !matchesFilters(category, {
                  typeValue: filterType,
                  itemType: (t) => t.type,
                  searchValue: searchFilter,
                  searchFields: [(t) => t.name],
                })
              )
                return null;
              return (
                <CategoriesCard
                  key={category.id}
                  category={category}
                  handleEdit={() => handleEdit(category)}
                  handleDelete={() => handleDelete(category.id)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      <CategoriesModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingCategory(null);
        }}
        sentFeed={() => {
          setRefreshFeed(true);
        }}
        editingCategory={editingCategory}
      />
    </>
  );
}