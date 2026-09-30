import { Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import LoadingSpinner from '../shared/LoadingSpinner';
import { CookieBanner } from '../CookieConsent';
import DueReviewProvider from '../due/DueReviewProvider';
import Tour from '../tour/Tour';
import { TourProvider } from '../../contexts/TourContext';
import { TOUR_STEPS } from '../tour/tourSteps';
import { PendingProvider } from '../../contexts/PendingContext';
import ErrorBoundary from '../shared/ErrorBoundary';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  return (
    <TourProvider total={TOUR_STEPS.length}>
      <PendingProvider>
        <DueReviewProvider>
        <div className="app-shell">
          <Navbar />
          <main className="layout-main">
            {/* key: un crash non deve bloccare le pagine successive */}
            <ErrorBoundary key={pathname}>
              <Suspense fallback={<LoadingSpinner size="lg" />}>{children}</Suspense>
            </ErrorBoundary>
          </main>
          <CookieBanner />
          <Tour />
        </div>
        </DueReviewProvider>
      </PendingProvider>
    </TourProvider>
  );
}