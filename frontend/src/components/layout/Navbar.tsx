import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
//@ts-ignore
import { LayoutDashboard, ArrowLeftRight, Tags, LogOut, Wallet, Repeat, Calendar } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard',     label: 'Dashboard',   icon: LayoutDashboard },
    { path: '/transactions',  label: 'Transazioni', icon: ArrowLeftRight },
    { path: '/categories',    label: 'Categorie',   icon: Tags },
    { path: '/budgets',       label: 'Budget',      icon: Wallet },
    { path: '/recurring',     label: 'Spese Fisse', icon: Repeat },
    { path: '/planned',       label: 'Spese Pianificate', icon: Calendar },
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

          {/* Navigation Links - Desktop */}
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

          {/* User Menu - Desktop */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-neutral-800">{user?.name}</p>
              <p className="text-xs text-neutral-500">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="btn-ghost-danger btn-md"
            >
              <LogOut className="icon-md" />
              <span className="font-medium">Esci</span>
            </button>
          </div>

          {/* User Menu - Mobile */}
          <button
            onClick={handleLogout}
            className="sm:hidden btn-icon-danger"
          >
            <LogOut className="icon-md" />
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
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