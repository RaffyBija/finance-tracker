import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { transactionAPI } from '../api/client';
import type { TransactionType } from '../types';

const DEBOUNCE_MS = 400;
const MIN_LENGTH = 2;

// Suggerisce una categoria in base allo storico dell'utente mentre digita la
// descrizione. La descrizione viene "debounced" per non interrogare il backend
// a ogni tasto. `enabled` permette al chiamante di disattivare il suggerimento
// (es. in modifica o quando una categoria è già scelta).
export const useSuggestedCategory = (
  description: string,
  type: TransactionType,
  enabled: boolean,
) => {
  const [debounced, setDebounced] = useState(description);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(description), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [description]);

  const normalized = debounced.trim();

  const query = useQuery({
    queryKey: ['suggest-category', type, normalized.toLowerCase()],
    queryFn: () => transactionAPI.suggestCategory(normalized, type),
    enabled: enabled && normalized.length >= MIN_LENGTH,
    staleTime: 60 * 1000,
  });

  return {
    suggestedCategoryId: query.data?.categoryId ?? null,
    isFetching: query.isFetching,
  };
};
