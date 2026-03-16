import { createRoot } from 'react-dom/client';
import { Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import App from './App.tsx';

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

// ✅ Lazy load: Vite esclude questo chunk dal bundle di produzione
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((mod) => ({
        default: mod.ReactQueryDevtools,
      }))
    )
  : () => null;

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
    <Suspense fallback={null}>
      <ReactQueryDevtools initialIsOpen={false} />
    </Suspense>
  </QueryClientProvider>
);