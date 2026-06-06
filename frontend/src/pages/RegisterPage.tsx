import { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';
import { detectBrowserCurrency, CURRENCY_OPTIONS } from '../utils/currency';

export default function RegisterPage() {
  const [name, setName]                       = useState('');
  const [email, setEmail]                     = useState('');
  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency]               = useState(() => detectBrowserCurrency());
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [error, setError]                     = useState('');
  const [isLoading, setIsLoading]             = useState(false);
  const [success, setSuccess]                 = useState(false);

  const { register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non corrispondono');
      return;
    }
    if (password.length < 6) {
      setError('La password deve essere di almeno 6 caratteri');
      return;
    }

    setIsLoading(true);
    try {
      await register({ email, password, name, currency });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="auth-status">
          <div className="auth-status-icon is-mail">
            <Mail size={28} />
          </div>
          <h1 className="auth-status-title">Registrazione completata!</h1>
          <p className="auth-status-text">
            Riceverai una email di verifica all'indirizzo fornito. Clicca sul link per attivare il tuo account.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">
            Torna al login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Crea account</h1>
      <p className="auth-subtitle">Inizia a gestire le tue finanze</p>

      <form autoComplete="off" onSubmit={handleSubmit}>
        <div className="auth-fields">

          <div className="form-group">
            <label htmlFor="name" className="form-label">Nome completo</label>
            <div className="auth-field-wrap">
              <span className="auth-field-icon"><User size={15} /></span>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="form-input"
                placeholder="Mario Rossi"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">Email</label>
            <div className="auth-field-wrap">
              <span className="auth-field-icon"><Mail size={15} /></span>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="mario.rossi@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="currency" className="form-label">Valuta</label>
            <div className="auth-field-wrap">
              <span className="auth-field-icon"><Coins size={15} /></span>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="form-select"
              >
                {CURRENCY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <div className="auth-field-wrap">
              <span className="auth-field-icon"><Lock size={15} /></span>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input has-toggle"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-pass-toggle"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Nascondi password' : 'Mostra password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">Conferma password</label>
            <div className="auth-field-wrap">
              <span className="auth-field-icon"><Lock size={15} /></span>
              <input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="form-input has-toggle"
                placeholder="••••••••"
              />
              <button
                type="button"
                className="auth-pass-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Nascondi password' : 'Mostra password'}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`btn btn-primary btn-block btn-lg${isLoading ? ' btn-loading' : ''}`}
        >
          {isLoading ? 'Registrazione in corso...' : 'Registrati'}
        </button>
      </form>

      <p className="auth-link-row">
        Hai già un account?{' '}
        <Link to="/login">Accedi</Link>
      </p>
    </AuthLayout>
  );
}
