import { useState} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard, ArrowLeftRight, Tags, LogOut,
  Wallet, Repeat, Calendar, User, ChevronDown,
  Shield, FileText,
} from 'lucide-react';

function UserAvatar({ name, size = 'md' }: { name?: string; size?: 'sm' | 'md' }) {
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm';
  return (
    <div className={`${sizeClasses} rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0`}>
      <span className="font-semibold text-white">{initials}</span>
    </div>
  );
}

function ProfileDropdown({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const open = Boolean(anchorEl);

  if (!open) return null;

  const handleNavigate = (path: string) => {
    onClose();
    navigate(path);
  };

  const handleLogout = () => {
    onClose();
    logout();
    navigate('/');
  };

  return (
    <>
      {/* ✅ Overlay trasparente che cattura i click fuori dal menu */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Menu */}
      <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-neutral-200 z-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
          <p className="font-semibold text-neutral-900 text-sm truncate">{user?.name}</p>
          <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
        </div>

        <div className="py-1">
          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Account
          </p>
          <button
            onClick={() => handleNavigate('/profile')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
          >
            <User className="icon-sm text-neutral-400" />
            Impostazioni profilo
          </button>
          <button
            onClick={() => handleNavigate('/profile')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
          >
            <Shield className="icon-sm text-neutral-400" />
            Sicurezza e password
          </button>

          <div className="border-t border-neutral-100 my-1" />

          <p className="px-4 pt-2 pb-1 text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Altro
          </p>
          <button
            onClick={() => handleNavigate('/privacy')}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors text-left"
          >
            <FileText className="icon-sm text-neutral-400" />
            Privacy Policy
          </button>

          <div className="border-t border-neutral-100 my-1" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-600 hover:bg-danger-50 transition-colors text-left"
          >
            <LogOut className="icon-sm" />
            Esci
          </button>
        </div>
      </div>
    </>
  );
}

export default function Navbar() {
  const { user } = useAuth();
  const location = useLocation();

  // ✅ Pattern MUI: anchor element invece di booleano
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>) => {
    // ✅ Se il menu è già aperto e clicco di nuovo il trigger, lo chiudo
    if (anchorEl) {
      setAnchorEl(null);
    } else {
      setAnchorEl(e.currentTarget);
    }
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const navItems = [
    { path: '/dashboard',    label: 'Dashboard',         icon: LayoutDashboard },
    { path: '/transactions', label: 'Transazioni',       icon: ArrowLeftRight },
    { path: '/categories',   label: 'Categorie',         icon: Tags },
    { path: '/budgets',      label: 'Budget',            icon: Wallet },
    { path: '/recurring',    label: 'Spese Fisse',       icon: Repeat },
    { path: '/planned',      label: 'Spese Pianificate', icon: Calendar },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-neutral-200">
      <div className="container-custom">
        <div className="flex-between h-16">

          {/* Logo */}
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="bg-primary-600 rounded-lg p-2">
              <Wallet className="icon-lg text-white" />
            </div>
            <span className="text-xl font-bold text-neutral-800">Finance Tracker</span>
          </Link>

          {/* Navigation Links — Desktop */}
          <div className="hidden md:flex gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <Icon className="icon-md" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* User Menu — Desktop */}
          <div className="hidden sm:flex items-center">
            <div className="relative">
              <button
                onClick={handleOpenMenu}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition-colors"
              >
                <UserAvatar name={user?.name} />
                <span className="text-sm font-medium text-neutral-800 max-w-[120px] truncate">
                  {user?.name}
                </span>
                <ChevronDown
                  className={`icon-sm text-neutral-400 transition-transform duration-200 ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <ProfileDropdown anchorEl={anchorEl} onClose={handleCloseMenu} />
            </div>
          </div>

          {/* User Menu — Mobile */}
          <div className="sm:hidden relative">
            <button
              onClick={handleOpenMenu}
              className="p-1 rounded-full hover:bg-neutral-100 transition-colors"
            >
              <UserAvatar name={user?.name} size="sm" />
            </button>

            <ProfileDropdown anchorEl={anchorEl} onClose={handleCloseMenu} />
          </div>

        </div>
      </div>

      {/* Mobile Navigation — bottom bar */}
      <div className="md:hidden border-t border-neutral-200">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center py-3 px-2 flex-1 touch-target ${
                  isActive ? 'text-primary-700' : 'text-neutral-600'
                }`}
              >
                <Icon className="icon-lg" />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}