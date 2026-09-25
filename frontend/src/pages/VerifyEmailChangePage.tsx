import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import axios from 'axios';
import AuthLayout from '../components/layout/AuthLayout';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

export default function VerifyEmailChangePage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Token mancante o non valido');
        return;
      }
      try {
        const res = await axios.post(`${API_URL}/auth/verify-email-change`, { token });
        setStatus('success');
        setMessage(res.data.message);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Errore durante la verifica');
      }
    };
    verify();
  }, [token]);

  if (status === 'loading') {
    return (
      <AuthLayout>
        <div className="auth-status">
          <div className="auth-status-icon is-loading">
            <Loader size={28} className="auth-spin" />
          </div>
          <h1 className="auth-status-title">Verifica in corso...</h1>
          <p className="auth-status-text">Stiamo confermando il tuo nuovo indirizzo email</p>
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
          <h1 className="auth-status-title">Email aggiornata!</h1>
          <p className="auth-status-text">{message}</p>
          <Link to="/login" className="btn btn-primary btn-block">
            Accedi con il nuovo indirizzo
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
        <Link to="/profile" className="btn btn-primary btn-block">
          Torna al profilo
        </Link>
      </div>
    </AuthLayout>
  );
}