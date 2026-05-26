import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout from '../components/layout/AuthLayout';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      setIsLoading(true);
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">Bentornato</h1>
      <p className="auth-subtitle">Accedi al tuo account</p>

      <form onSubmit={handleSubmit}>
        <div className="auth-fields">

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
            <div className="auth-label-row">
              <label htmlFor="password" className="form-label">Password</label>
              <Link to="/forgot-password" className="auth-forgot-link">
                Password dimenticata?
              </Link>
            </div>
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

        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`btn btn-primary btn-block btn-lg${isLoading ? ' btn-loading' : ''}`}
        >
          {isLoading ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>

      <p className="auth-link-row">
        Non hai un account?{' '}
        <Link to="/register">Registrati</Link>
      </p>
    </AuthLayout>
  );
}
