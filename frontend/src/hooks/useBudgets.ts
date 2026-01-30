import { useState, useEffect } from 'react';
import { budgetApi } from '../api/budgets';
import { categoryAPI } from '../api/client';
import type { Budget, Category } from '../types';

/**
 * Hook per gestire stato e operazioni dei budget
 */
export function useBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [budgetsData, categoriesData] = await Promise.all([
        budgetApi.getAll(),
        categoryAPI.getAll({ type: 'EXPENSE' }),
      ]);
      setBudgets(budgetsData);
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
    await budgetApi.delete(id);
    refresh();
  };

  return {
    budgets,
    categories,
    isLoading,
    refresh,
    handleDelete,
  };
}
