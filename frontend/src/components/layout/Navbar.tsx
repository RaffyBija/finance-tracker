import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePending } from '../../contexts/PendingContext';
import { useTourContext } from '../../contexts/TourContext';
import GuideModal from '../shared/GuideModal';
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tags,
  Repeat, Calendar, CalendarDays, Settings2, ChevronDown,
  SlidersHorizontal, FileText, LogOut, Landmark,
  BookOpen, PlayCircle, PiggyBank, LineChart, Menu,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

// ── Nav structure ─────────────────────────────────────────────────────────────

// Link primari (desktop top bar + mobile bottom bar): le stesse 4 voci operative.
// Analisi (Patrimonio, Proiezione) e Gestione vivono nel dropdown/tray, non qui.
const PRIMARY: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni', icon: ArrowLeftRight  },
  { path: '/accounts',     label: 'Conti',       icon: Landmark        },
  { path: '/calendar',     label: 'Calendario',  icon: CalendarDays    },
];

// Sezione "Analisi" del menu (dropdown desktop + tray mobile).
const ANALISI: NavItem[] = [
  { path: '/patrimonio', label: 'Patrimonio', icon: PiggyBank },
  { path: '/projection', label: 'Proiezione', icon: LineChart },
];

// Sezione "Gestione": configurazione delle entità.
const CONFIG: NavItem[] = [
  { path: '/budgets',    label: 'Budget',      icon: Wallet  },
  { path: '/categories', label: 'Categorie',   icon: Tags    },
  { path: '/recurring',  label: 'Ricorrenti',  icon: Repeat  },
  { path: '/planned',    label: 'Pianificati', icon: Calendar },
];

const CONFIG_PATHS = CONFIG.map((g) => g.path);
// Voci raggiungibili dal menu mobile (per evidenziare il tab "Menu").
const MENU_PATHS = [...ANALISI.map((a) => a.path), ...CONFIG_PATHS];

// ── UserAvatar ────────────────────────────────────────────────────────────────

function UserAvatar({ name, size = 36 }: { name?: string; size?: number }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: '#0d9488',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        fontSize: size * 0.36,
        flexShrink: 0,
        letterSpacing: '-0.3px',
      }}
    >
      {initials}
    </div>
  );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────

function ProfileDropdown({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { restart: restartTour } = useTourContext();
  const [guideOpen, setGuideOpen] = useState(false);

  const go = (path: string) => { onClose(); navigate(path); };
  const handleLogout = () => { onClose(); logout(); navigate('/'); };
  const handleTour = () => { onClose(); restartTour(); };
  const handleGuide = () => setGuideOpen(true);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <GuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <div className="navbar-profile-panel">
        <div className="navbar-profile-header">
          <div className="navbar-profile-name-row">
            <p className="navbar-profile-name">{user?.name}</p>
            {user?.isPro && <span className="pro-badge">PRO</span>}
          </div>
          <p className="navbar-profile-email">{user?.email}</p>
        </div>
        <div className="navbar-profile-body">

          <p className="navbar-profile-section-label">Account</p>
          <button onClick={() => go('/profile')} className="navbar-profile-item">
            <SlidersHorizontal size={15} className="navbar-profile-item-icon" />
            Impostazioni
          </button>

          <div className="navbar-profile-divider" />
          <p className="navbar-profile-section-label">Aiuto</p>
          <button onClick={handleGuide} className="navbar-profile-item">
            <BookOpen size={15} className="navbar-profile-item-icon" />
            Guida all'app
          </button>
          <button onClick={handleTour} className="navbar-profile-item">
            <PlayCircle size={15} className="navbar-profile-item-icon" />
            Riavvia tour
          </button>

          <div className="navbar-profile-divider" />
          <p className="navbar-profile-section-label">Altro</p>
          <button onClick={() => go('/privacy')} className="navbar-profile-item">
            <FileText size={15} className="navbar-profile-item-icon" />
            Privacy Policy
          </button>

          <div className="navbar-profile-divider" />
          <button onClick={handleLogout} className="navbar-profile-item navbar-profile-logout">
            <LogOut size={15} />
            Esci
          </button>

        </div>
      </div>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const { user } = useAuth();
  const { recurringDueCount, plannedDueCount } = usePending();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isMenuActive = MENU_PATHS.includes(location.pathname);
  // Il dropdown desktop contiene Analisi + Gestione: evidenzialo quando si è su una
  // sua pagina che NON è già un link primario (es. /projection, o le pagine Gestione).
  const isDropdownActive =
    isMenuActive && !PRIMARY.some((p) => p.path === location.pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setTrayOpen(false); },    [location.pathname]);
  useEffect(() => { setDropdownOpen(false); }, [location.pathname]);

  return (
    <>
      <nav className={`navbar${scrolled ? ' is-scrolled' : ''}`}>
        <div className="navbar-inner">

          {/* Logo */}
          <Link to="/dashboard" className="navbar-logo">
            <div className="navbar-logo-badge">
              <Wallet size={17} />
            </div>
            <span className="navbar-wordmark">Finance Tracker</span>
          </Link>

          {/* Desktop primary links + Gestione dropdown */}
          <div className="navbar-primary">
            {PRIMARY.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`navbar-link${location.pathname === path ? ' is-active' : ''}`}
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}

            <div className="navbar-dropdown" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className={`navbar-dropdown-trigger${isDropdownActive ? ' is-active-group' : ''}`}
              >
                <Settings2 size={15} />
                Gestione
                <ChevronDown
                  size={13}
                  className={`navbar-dropdown-chevron${dropdownOpen ? ' is-open' : ''}`}
                />
              </button>

              {dropdownOpen && (
                <div className="navbar-dropdown-panel">
                  <p className="navbar-dropdown-section">Analisi</p>
                  {ANALISI.map(({ path, label, icon: Icon }) => (
                    <Link
                      key={path}
                      to={path}
                      className={`navbar-dropdown-item${location.pathname === path ? ' is-active' : ''}`}
                    >
                      <Icon size={15} className="navbar-dropdown-item-icon" />
                      {label}
                    </Link>
                  ))}

                  <p className="navbar-dropdown-section navbar-dropdown-section--divided">Gestione</p>
                  {CONFIG.map(({ path, label, icon: Icon }) => {
                    const count = path === '/recurring' ? recurringDueCount : path === '/planned' ? plannedDueCount : 0;
                    return (
                      <Link
                        key={path}
                        to={path}
                        className={`navbar-dropdown-item${location.pathname === path ? ' is-active' : ''}`}
                      >
                        <Icon size={15} className="navbar-dropdown-item-icon" />
                        {label}
                        {count > 0 && <span className="navbar-inline-badge">{count > 99 ? '99+' : count}</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* User menu (no more theme button here) */}
          <div className="navbar-right">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="navbar-user-trigger"
            >
              <UserAvatar name={user?.name} size={34} />
              <span className="navbar-user-name">{user?.name}</span>
              {user?.isPro && <span className="pro-badge">PRO</span>}
              <ChevronDown
                size={13}
                className={`navbar-user-chevron${profileOpen ? ' is-open' : ''}`}
              />
            </button>

            {profileOpen && <ProfileDropdown onClose={() => setProfileOpen(false)} />}
          </div>

        </div>
      </nav>

      {/* Mobile bottom bar — 5 tabs: 4 primary + Menu */}
      <div className="navbar-mobile-bar" data-tour="mobile-nav">
        {PRIMARY.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`navbar-mobile-tab${location.pathname === path ? ' is-active' : ''}`}
          >
            <Icon size={20} />
            <span className="navbar-mobile-tab-label">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setTrayOpen((v) => !v)}
          className={`navbar-mobile-tab${isMenuActive ? ' is-active' : ''}`}
          data-tour="gestione-btn"
        >
          <span className="navbar-badge-wrap">
            <Menu size={20} />
            {(recurringDueCount + plannedDueCount) > 0 && (
              <span className="navbar-badge">
                {(recurringDueCount + plannedDueCount) > 99 ? '99+' : recurringDueCount + plannedDueCount}
              </span>
            )}
          </span>
          <span className="navbar-mobile-tab-label">Menu</span>
        </button>
      </div>

      {/* Mobile menu tray — sezioni Analisi + Gestione */}
      {trayOpen && (
        <>
          <div className="navbar-tray-backdrop" onClick={() => setTrayOpen(false)} />
          <div className="navbar-tray">
            <div className="navbar-tray-handle" />

            <p className="navbar-tray-title">Analisi</p>
            {ANALISI.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                className={`navbar-tray-item${location.pathname === path ? ' is-active' : ''}`}
              >
                <Icon size={19} className="navbar-tray-item-icon" />
                {label}
              </Link>
            ))}

            <p className="navbar-tray-title navbar-tray-section">Gestione</p>
            {CONFIG.map(({ path, label, icon: Icon }) => {
              const count = path === '/recurring' ? recurringDueCount : path === '/planned' ? plannedDueCount : 0;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`navbar-tray-item${location.pathname === path ? ' is-active' : ''}`}
                >
                  <Icon size={19} className="navbar-tray-item-icon" />
                  {label}
                  {count > 0 && <span className="navbar-inline-badge">{count > 99 ? '99+' : count}</span>}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
