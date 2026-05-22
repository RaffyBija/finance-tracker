import type { ReactNode } from 'react';
import Navbar from './Navbar';
import { CookieBanner } from '../CookieConsent';
import RecurringDueGuard from '../recurring/RecurringDueGuard';
import { PendingProvider } from '../../contexts/PendingContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <PendingProvider>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <Navbar />
        <main className="layout-main">
          {children}
        </main>
        <CookieBanner />
        <RecurringDueGuard />
      </div>
    </PendingProvider>
  );
}