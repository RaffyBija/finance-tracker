import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Preferenza scelta dall'utente. 'system' segue il tema del sistema operativo.
export type ThemePreference = 'light' | 'dark' | 'system';
// Tema effettivamente applicato (mai 'system': è già risolto).
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'theme';

function readPreference(): ThemePreference {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  // Legacy / nessun valore: trattato come "segui il sistema".
  return 'system';
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readPreference()));

  // Applica la classe .dark e persiste la preferenza ad ogni cambio.
  useEffect(() => {
    const resolved = resolve(preference);
    setResolvedTheme(resolved);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    localStorage.setItem(STORAGE_KEY, preference);
  }, [preference]);

  // Quando la preferenza è 'system', reagisce ai cambi del tema OS in tempo reale.
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const resolved = systemPrefersDark() ? 'dark' : 'light';
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => setPreferenceState(p), []);

  return (
    <ThemeContext.Provider value={{ preference, resolvedTheme, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve essere usato dentro <ThemeProvider>');
  return ctx;
}
