import { Suspense, type ReactNode } from 'react';
import Navbar from './Navbar';
import LoadingSpinner from '../shared/LoadingSpinner';
import { CookieBanner } from '../CookieConsent';
import RecurringDueGuard from '../recurring/RecurringDueGuard';
import CCBillingGuard from '../accounts/CCBillingGuard';
import Tour from '../tour/Tour';
import { TourProvider } from '../../contexts/TourContext';
import { TOUR_STEPS } from '../tour/tourSteps';
import { PendingProvider } from '../../contexts/PendingContext';
import ErrorBoundary from '../shared/ErrorBoundary';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <TourProvider total={TOUR_STEPS.length}>
      <PendingProvider>
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
          <Navbar />
          <main className="layout-main">
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner size="lg" />}>{children}</Suspense>
            </ErrorBoundary>
          </main>
          <CookieBanner />
          <RecurringDueGuard />
          <CCBillingGuard />
          <Tour />
        </div>
      </PendingProvider>
    </TourProvider>
  );
}