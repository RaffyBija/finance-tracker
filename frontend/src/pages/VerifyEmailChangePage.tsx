import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import axios from 'axios';

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
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
        <div className="card card-xl w-full max-w-md text-center">
          <div className="flex-center mb-6">
            <Loader className="icon-2xl text-primary-600 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-3">Verifica in corso...</h1>
          <p className="text-neutral-600">Stiamo confermando il tuo nuovo indirizzo email</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
        <div className="card card-xl w-full max-w-md text-center">
          <div className="flex-center mb-6">
            <div className="bg-success-100 rounded-full p-4">
              <CheckCircle className="icon-2xl text-success-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 mb-3">Email aggiornata!</h1>
          <p className="text-neutral-600 mb-6">{message}</p>
          <Link to="/login" className="btn btn-primary btn-block">
            Accedi con il nuovo indirizzo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
      <div className="card card-xl w-full max-w-md text-center">
        <div className="flex-center mb-6">
          <div className="bg-danger-100 rounded-full p-4">
            <XCircle className="icon-2xl text-danger-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-neutral-800 mb-3">Verifica fallita</h1>
        <p className="text-neutral-600 mb-6">{message}</p>
        <Link to="/profile" className="btn btn-primary btn-block">
          Torna al profilo
        </Link>
      </div>
    </div>
  );
}