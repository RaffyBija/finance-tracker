import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { authAPI } from '../api/client';
import { getToken, setToken as persistToken, clearToken } from '../utils/tokenStorage';
import type { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../types';


interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all\'interno di AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getToken());
  // true solo se esiste un token da verificare — evita lo spinner su /login senza sessione attiva
  const [isLoading, setIsLoading] = useState(() => !!getToken());

  // Verifica il token all'avvio
  useEffect(() => {
    let cancelled = false;

    // Esito di una verifica del token: ok | non autorizzato (401) | errore di rete/timeout.
    const fetchUser = async (savedToken: string): Promise<'ok' | 'unauthorized' | 'network'> => {
      try {
        const userData = await authAPI.getMe();
        if (!cancelled) {
          setUser(userData);
          setToken(savedToken);
        }
        return 'ok';
      } catch (error: any) {
        // Token cancellato SOLO se davvero non valido/scaduto (401).
        if (error?.response?.status === 401) {
          if (!cancelled) {
            clearToken();
            setToken(null);
          }
          return 'unauthorized';
        }
        // Nessun response → errore di rete/timeout: manteniamo la sessione.
        return 'network';
      }
    };

    const initAuth = async () => {
      const savedToken = getToken();
      if (!savedToken) {
        setIsLoading(false);
        return;
      }

      const result = await fetchUser(savedToken);
      // Sblocca subito la UI: niente spinner infinito anche se il backend è lento/irraggiungibile.
      if (!cancelled) setIsLoading(false);

      // Errore di rete/timeout (es. backend in cold-start dopo un deploy): teniamo il token e
      // ritentiamo in background con backoff, così lo user si popola appena il backend torna su.
      if (result === 'network') {
        for (const delay of [2000, 4000, 8000]) {
          await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          const retry = await fetchUser(savedToken);
          if (retry !== 'network') return;
        }
      }
    };

    initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    const response = await authAPI.login(credentials);
    persistToken(response.token, !!credentials.rememberMe);
    setToken(response.token);
    setUser(response.user);
  };

  const register = async (credentials: RegisterCredentials) => {
    const response = await authAPI.register(credentials);
    return response;
  };

  const logout = () => {
    clearToken();
    setToken(null);
    setUser(null);
  };

  const updateUser = useCallback((updatedData: Partial<User>) => {
  setUser((prev) => prev ? { ...prev, ...updatedData } : prev);
}, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};