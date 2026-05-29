import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const TOUR_KEY = 'tourCompleted';

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
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(TOUR_KEY) !== 'true') {
      const t = setTimeout(() => setIsActive(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const complete = useCallback(() => {
    localStorage.setItem(TOUR_KEY, 'true');
    setIsActive(false);
    setCurrentStep(0);
  }, []);

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
