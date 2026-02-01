import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import './styles/index.css';
import App from './App.tsx';

// Crea QueryClient con configurazione ottimizzata
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // I dati sono "freschi" per 5 minuti
      gcTime: 10 * 60 * 1000, // Cache per 10 minuti
      refetchOnWindowFocus: false, // Non refetch quando torni sulla tab
      refetchOnMount: false, // Non refetch al mount se i dati sono in cache
      retry: 1, // Riprova solo 1 volta in caso di errore
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
);