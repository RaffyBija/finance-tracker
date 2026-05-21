import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePending } from '../../contexts/PendingContext';
import {
  LayoutDashboard, ArrowLeftRight, Wallet, Tags,
  Repeat, Calendar, Settings2, ChevronDown,
  User, Shield, FileText, LogOut,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
}

// ── Nav structure ─────────────────────────────────────────────────────────────

const PRIMARY: NavItem[] = [
  { path: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { path: '/transactions', label: 'Transazioni',  icon: ArrowLeftRight  },
  { path: '/budgets',      label: 'Budget',       icon: Wallet          },
];

const GESTIONE: NavItem[] = [
  { path: '/categories', label: 'Categorie',  icon: Tags     },
  { path: '/recurring',  label: 'Ricorrenti', icon: Repeat   },
  { path: '/planned',    label: 'Pianificati', icon: Calendar },
];

const GESTIONE_PATHS = GESTIONE.map((g) => g.path);

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

  const go = (path: string) => { onClose(); navigate(path); };
  const handleLogout = () => { onClose(); logout(); navigate('/'); };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="navbar-profile-panel">
        <div className="navbar-profile-header">
          <p className="navbar-profile-name">{user?.name}</p>
          <p className="navbar-profile-email">{user?.email}</p>
        </div>
        <div className="navbar-profile-body">
          <p className="navbar-profile-section-label">Account</p>
          <button onClick={() => go('/profile')} className="navbar-profile-item">
            <User size={15} className="navbar-profile-item-icon" />
            Impostazioni profilo
          </button>
          <button onClick={() => go('/profile')} className="navbar-profile-item">
            <Shield size={15} className="navbar-profile-item-icon" />
            Sicurezza e password
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

  const isGestioneActive = GESTIONE_PATHS.includes(location.pathname);

  // Scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close Gestione dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close tray on route change
  useEffect(() => { setTrayOpen(false); }, [location.pathname]);

  // Close dropdown on route change
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
                className={`navbar-dropdown-trigger${isGestioneActive ? ' is-active-group' : ''}`}
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
                  <p className="navbar-dropdown-section">Configura</p>
                  {GESTIONE.map(({ path, label, icon: Icon }) => {
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

          {/* User menu */}
          <div className="navbar-right">
            <button
              onClick={() => setProfileOpen((v) => !v)}
              className="navbar-user-trigger"
            >
              <UserAvatar name={user?.name} size={34} />
              <span className="navbar-user-name">{user?.name}</span>
              <ChevronDown
                size={13}
                className={`navbar-user-chevron${profileOpen ? ' is-open' : ''}`}
              />
            </button>

            {profileOpen && <ProfileDropdown onClose={() => setProfileOpen(false)} />}
          </div>

        </div>
      </nav>

      {/* Mobile bottom bar */}
      <div className="navbar-mobile-bar">
        {PRIMARY.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`navbar-mobile-tab${location.pathname === path ? ' is-active' : ''}`}
          >
            <Icon size={21} />
            <span className="navbar-mobile-tab-label">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setTrayOpen((v) => !v)}
          className={`navbar-mobile-tab${isGestioneActive ? ' is-active' : ''}`}
        >
          <span className="navbar-badge-wrap">
            <Settings2 size={21} />
            {(recurringDueCount + plannedDueCount) > 0 && (
              <span className="navbar-badge">
                {(recurringDueCount + plannedDueCount) > 99 ? '99+' : recurringDueCount + plannedDueCount}
              </span>
            )}
          </span>
          <span className="navbar-mobile-tab-label">Gestione</span>
        </button>
      </div>

      {/* Mobile Gestione tray */}
      {trayOpen && (
        <>
          <div className="navbar-tray-backdrop" onClick={() => setTrayOpen(false)} />
          <div className="navbar-tray">
            <div className="navbar-tray-handle" />
            <p className="navbar-tray-title">Gestione</p>
            {GESTIONE.map(({ path, label, icon: Icon }) => {
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
