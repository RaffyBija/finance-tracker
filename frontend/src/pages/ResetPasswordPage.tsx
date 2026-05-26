import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import axios from 'axios';
import AuthLayout from '../components/layout/AuthLayout';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

export default function ResetPasswordPage() {
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();

  const [password, setPassword]               = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass]               = useState(false);
  const [showConfirm, setShowConfirm]         = useState(false);
  const [isLoading, setIsLoading]             = useState(false);
  const [success, setSuccess]                 = useState(false);
  const [error, setError]                     = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) setError('Token mancante o non valido');
  }, [token]);

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
    if (!token) {
      setError('Token non valido');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { token, newPassword: password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il reset della password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="auth-status">
          <div className="auth-status-icon is-success">
            <CheckCircle size={28} />
          </div>
          <h1 className="auth-status-title">Password reimpostata!</h1>
          <p className="auth-status-text">
            La tua password è stata aggiornata. Verrai reindirizzato al login tra pochi secondi.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">
            Vai al login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="auth-title">Nuova password</h1>
      <p className="auth-subtitle">Scegli una password sicura di almeno 6 caratteri.</p>

      <form onSubmit={handleSubmit}>
        <div className="auth-fields">

          <div className="form-group">
            <label htmlFor="password" className="form-label">Nuova password</label>
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
                disabled={isLoading || !token}
                minLength={6}
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
                disabled={isLoading || !token}
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
          disabled={isLoading || !token}
          className={`btn btn-primary btn-block btn-lg${isLoading ? ' btn-loading' : ''}`}
        >
          {isLoading ? 'Salvataggio...' : 'Reimposta password'}
        </button>
      </form>

      <p className="auth-link-row">
        <Link to="/login" className="auth-back-link">
          Torna al login
        </Link>
      </p>
    </AuthLayout>
  );
}
