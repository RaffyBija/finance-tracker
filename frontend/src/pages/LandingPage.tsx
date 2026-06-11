// Landing "Il saldo che respira" — orchestratore.
// Gestisce la lingua (IT/EN) e compone le sezioni dentro `.lp-root`.
// Il tema (light/dark) è gestito globalmente da ThemeContext: il CSS legge `html.dark`.
import { useState } from 'react';
import LandingNav from '../components/landing/LandingNav';
import LandingHero from '../components/landing/LandingHero';
import LandingMoments from '../components/landing/LandingMoments';
import LandingIndex from '../components/landing/LandingIndex';
import LandingClosing from '../components/landing/LandingClosing';
import LandingFooter from '../components/landing/LandingFooter';
import { COPY } from '../components/landing/landingCopy';
import type { Lang } from '../components/landing/landingCopy';

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('it');
  const t = COPY[lang];

  return (
    <div className="lp-root">
      <LandingNav lang={lang} setLang={setLang} t={t} />
      {/* key={lang} rimonta il contenuto al cambio lingua → rigioca le animazioni */}
      <main key={lang}>
        <LandingHero t={t} lang={lang} />
        <LandingMoments t={t} lang={lang} />
        <LandingIndex t={t} />
        <LandingClosing t={t} />
      </main>
      <LandingFooter t={t} />
    </div>
  );
}
