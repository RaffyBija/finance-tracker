// Nav sticky della landing: brand, link "Entra", switch IT/EN, toggle tema.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import type { Lang, LandingCopy } from './landingCopy';

interface LandingNavProps {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: LandingCopy;
}

export default function LandingNav({ lang, setLang, t }: LandingNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const { resolvedTheme, setPreference } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isLight = resolvedTheme === 'light';

  return (
    <nav className={'nav' + (scrolled ? ' scrolled' : '')}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top" aria-label="Finance Tracker">
          <span className="brand-mark"><Wallet size={15} /></span>
          Finance Tracker
        </a>
        <div className="nav-tools">
          <Link className="ghost-link" to="/login">{t.login}</Link>
          <div className="seg" role="group" aria-label={t.langLabel}>
            <button
              className={lang === 'it' ? 'on' : ''}
              aria-pressed={lang === 'it'}
              onClick={() => setLang('it')}
              type="button"
            >IT</button>
            <button
              className={lang === 'en' ? 'on' : ''}
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
              type="button"
            >EN</button>
          </div>
          <button
            className="icon-btn"
            type="button"
            onClick={() => setPreference(isLight ? 'dark' : 'light')}
            aria-label={isLight ? t.toDark : t.toLight}
          >
            {isLight ? <Moon size={17} /> : <Sun size={17} />}
          </button>
        </div>
      </div>
    </nav>
  );
}
