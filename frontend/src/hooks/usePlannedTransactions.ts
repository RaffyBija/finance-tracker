import { useState, useEffect } from 'react';
import { plannedApi } from '../api/planned';
import { categoryAPI } from '../api/client';
import type { PlannedTransaction, Category } from '../types';

type FilterStatus = 'ALL' | 'UNPAID' | 'PAID';

/**
 * Hook per gestire stato e operazioni delle transazioni pianificate
 */
export function usePlannedTransactions() {
  const [planned, setPlanned] = useState<PlannedTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('UNPAID');

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const params = filterStatus === 'UNPAID' ? { unpaidOnly: true } : {};
      const [plannedData, categoriesData] = await Promise.all([
        plannedApi.getAll(params),
        categoryAPI.getAll(),
      ]);

      // Filtra in base allo stato
      let filteredData = plannedData;
      if (filterStatus === 'PAID') {
        filteredData = plannedData.filter((p) => p.isPaid);
      } else if (filterStatus === 'UNPAID') {
        filteredData = plannedData.filter((p) => !p.isPaid);
      }

      setPlanned(filteredData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Errore nel caricamento:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = () => {
    loadData();
  };

  const handleDelete = async (id: string) => {
    await plannedApi.delete(id);
    refresh();
  };

  const handleMarkAsPaid = async (id: string) => {
    await plannedApi.markAsPaid(id);
    refresh();
  };

  return {
    planned,
    categories,
    isLoading,
    filterStatus,
    setFilterStatus,
    refresh,
    handleDelete,
    handleMarkAsPaid,
  };
}
