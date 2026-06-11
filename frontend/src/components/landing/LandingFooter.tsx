// Footer essenziale.
import { Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LandingCopy } from './landingCopy';

interface LandingFooterProps {
  t: LandingCopy;
}

export default function LandingFooter({ t }: LandingFooterProps) {
  // Solo "Privacy" ha una pagina reale (/privacy); gli altri sono segnaposto.
  const [privacy, ...rest] = t.footLinks;
  return (
    <footer>
      <div className="wrap foot-inner">
        <a className="brand" href="#top">
          <span className="brand-mark"><Wallet size={15} /></span>
          Finance Tracker
        </a>
        <div className="foot-links">
          <Link to="/privacy">{privacy}</Link>
          {rest.map((l) => <a key={l} href="#top">{l}</a>)}
        </div>
        <span className="foot-note">{t.footNote}</span>
      </div>
    </footer>
  );
}
