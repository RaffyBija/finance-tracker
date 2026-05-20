import type { ReactNode } from 'react';
import Navbar from './Navbar';
import { CookieBanner } from '../CookieConsent';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Navbar />
      <main className="layout-main">
        {children}
      </main>
      <CookieBanner />
    </div>
  );
}