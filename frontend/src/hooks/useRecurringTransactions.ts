import { useState, useEffect } from 'react';
import { recurringApi } from '../api/recurring';
import { categoryAPI } from '../api/client';
import type { RecurringTransaction, Category } from '../types';

/**
 * Hook per gestire stato e operazioni delle transazioni ricorrenti
 */
export function useRecurringTransactions() {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [recurringData, categoriesData] = await Promise.all([
        recurringApi.getAll(),
        categoryAPI.getAll(),
      ]);
      setRecurring(recurringData);
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
    await recurringApi.delete(id);
    refresh();
  };

  const handleToggle = async (id: string) => {
    await recurringApi.toggle(id);
    refresh();
  };

  return {
    recurring,
    categories,
    isLoading,
    refresh,
    handleDelete,
    handleToggle,
  };
}
