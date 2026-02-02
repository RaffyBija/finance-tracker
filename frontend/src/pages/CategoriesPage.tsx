import { useCategories, useDeleteCategory } from '../hooks/useCategories';
import type { Category, TransactionType } from '../types';
import { Plus } from 'lucide-react';
import FilterNav from '../components/layout/FilterNav';
import CategoriesModal from '../components/categories/CategoriesModal';
import CategoriesCard from '../components/categories/CategoriesCard';
import matchesFilters from '../utils/filters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { useState } from 'react';

export default function CategoriesPage() {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<TransactionType | 'ALL'>('ALL');
  const [searchFilter, setFilterSearch] = useState('');

  // React Query hooks - gestiscono cache, loading, refetch automaticamente
  const { data: categories = [], isLoading } = useCategories(filterType);
  const deleteCategoryMutation = useDeleteCategory();

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro? Le transazioni associate non verranno eliminate.'))
      return;
    
    try {
      await deleteCategoryMutation.mutateAsync(id);
      // React Query invalida automaticamente la cache
    } catch (error) {
      alert("Errore nell'eliminazione");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowModal(true);
  };

  const handleOpenModal = () => {
    setEditingCategory(null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCategory(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Caricamento Categorie..." />;
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
        onClose={handleCloseModal}
        sentFeed={() => {}} // React Query gestisce il refresh automaticamente
        editingCategory={editingCategory}
      />
    </>
  );
}