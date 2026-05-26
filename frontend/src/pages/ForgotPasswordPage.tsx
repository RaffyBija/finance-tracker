import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import AuthLayout from '../components/layout/AuthLayout';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

export default function ForgotPasswordPage() {
  const [email, setEmail]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await axios.post(`${API_URL}/auth/request-password-reset`, { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante la richiesta');
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
          <h1 className="auth-status-title">Email inviata!</h1>
          <p className="auth-status-text">
            Se l'indirizzo è registrato, riceverai un link per reimpostare la password. Controlla anche lo spam.
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
      <h1 className="auth-title">Password dimenticata</h1>
      <p className="auth-subtitle">Inserisci la tua email: ti inviamo un link di reset.</p>

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
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <button
          type="submit"
          disabled={isLoading}
          className={`btn btn-primary btn-block btn-lg${isLoading ? ' btn-loading' : ''}`}
        >
          {isLoading ? 'Invio in corso...' : 'Invia link di reset'}
        </button>
      </form>

      <p className="auth-link-row">
        <Link to="/login" className="auth-back-link">
          <ArrowLeft size={14} /> Torna al login
        </Link>
      </p>
    </AuthLayout>
  );
}
