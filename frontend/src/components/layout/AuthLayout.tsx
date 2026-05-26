import { Link } from 'react-router-dom';
import { Wallet, LayoutDashboard, TrendingUp, RefreshCw } from 'lucide-react';

const FEATURES = [
  { icon: LayoutDashboard, label: 'Entrate e uscite per categoria' },
  { icon: TrendingUp,      label: 'Trend mensili e proiezioni' },
  { icon: RefreshCw,       label: 'Spese ricorrenti in automatico' },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const year = new Date().getFullYear();

  return (
    <div className="auth-root">

      {/* ── Left: brand panel ── */}
      <div className="auth-left">
        <div className="auth-left-inner">

          <div className="auth-left-body">

            <Link to="/" className="auth-brand">
              <div className="auth-brand-icon">
                <Wallet size={18} />
              </div>
              <span className="auth-brand-name">Finance Tracker</span>
            </Link>

            <div className="auth-left-content">
              <p className="auth-tagline">
                Controlla le tue finanze<br />con precisione.
              </p>
              <ul className="auth-features">
                {FEATURES.map(({ icon: Icon, label }) => (
                  <li key={label} className="auth-feature">
                    <span className="auth-feature-icon">
                      <Icon size={14} />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          <p className="auth-left-footer">© {year} Finance Tracker</p>

        </div>
      </div>

      {/* ── Right: form area ── */}
      <div className="auth-right">
        <div className="auth-form-inner">
          {children}
        </div>
      </div>

    </div>
  );
}
