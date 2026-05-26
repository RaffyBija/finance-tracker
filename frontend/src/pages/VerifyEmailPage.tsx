import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import axios from 'axios';
import AuthLayout from '../components/layout/AuthLayout';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus]   = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token mancante o non valido');
        return;
      }
      try {
        const response = await axios.post(`${API_URL}/auth/verify-email`, { token });
        setStatus('success');
        setMessage(response.data.message || 'Email verificata con successo!');
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Errore durante la verifica');
      }
    };
    verifyEmail();
  }, [token]);

  if (status === 'loading') {
    return (
      <AuthLayout>
        <div className="auth-status">
          <div className="auth-status-icon is-loading">
            <Loader size={28} className="auth-spin" />
          </div>
          <h1 className="auth-status-title">Verifica in corso...</h1>
          <p className="auth-status-text">Stiamo verificando il tuo account.</p>
        </div>
      </AuthLayout>
    );
  }

  if (status === 'success') {
    return (
      <AuthLayout>
        <div className="auth-status">
          <div className="auth-status-icon is-success">
            <CheckCircle size={28} />
          </div>
          <h1 className="auth-status-title">Email verificata!</h1>
          <p className="auth-status-text">{message}</p>
          <Link to="/login" className="btn btn-primary btn-block">
            Accedi al tuo account
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="auth-status">
        <div className="auth-status-icon is-error">
          <XCircle size={28} />
        </div>
        <h1 className="auth-status-title">Verifica fallita</h1>
        <p className="auth-status-text">{message}</p>
        <div className="auth-status-actions">
          <Link to="/login" className="btn btn-primary btn-block">
            Vai al login
          </Link>
          <Link to="/register" className="btn btn-secondary btn-block">
            Registrati di nuovo
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
