import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { authAPI } from '../api/client';

interface TourContextType {
  isActive: boolean;
  currentStep: number;
  total: number;
  next: () => void;
  prev: () => void;
  skip: () => void;
  restart: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function TourProvider({ children, total }: { children: React.ReactNode; total: number }) {
  const { user, updateUser } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Avvia il tour solo se l'utente non lo ha mai completato (flag dal DB)
  useEffect(() => {
    if (user && !user.tourCompleted) {
      const t = setTimeout(() => setIsActive(true), 800);
      return () => clearTimeout(t);
    }
  }, [user?.tourCompleted]);

  const complete = useCallback(async () => {
    setIsActive(false);
    setCurrentStep(0);
    // Aggiorna DB + stato locale
    updateUser({ tourCompleted: true });
    try {
      await authAPI.completeTour();
    } catch {
      // Silenzioso — il tour è già visivamente chiuso, non vale la pena mostrare un errore
    }
  }, [updateUser]);

  const next = useCallback(() => {
    setCurrentStep((s) => {
      if (s < total - 1) return s + 1;
      complete();
      return 0;
    });
  }, [total, complete]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const skip = complete;

  // Restart: solo sessione corrente, non resetta il flag DB
  const restart = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  return (
    <TourContext.Provider value={{ isActive, currentStep, total, next, prev, skip, restart }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTourContext must be used within TourProvider');
  return ctx;
}
