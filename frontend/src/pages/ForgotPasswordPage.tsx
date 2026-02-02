import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Pagina per richiedere il reset della password
 * Invia email con link per reset
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
        <div className="card card-xl w-full max-w-md text-center">
          <div className="flex-center mb-6">
            <div className="gradient-primary rounded-full p-4">
              <Mail className="icon-2xl text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-neutral-800 mb-3">
            Email Inviata!
          </h1>
          
          <p className="text-neutral-600 mb-6">
            Se l'email esiste nel nostro sistema, riceverai un link per reimpostare la password.
            Controlla la tua casella di posta (anche spam).
          </p>

          <Link to="/login" className="btn btn-primary btn-block">
            <ArrowLeft className="icon-md" />
            Torna al Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
      <div className="card card-xl w-full max-w-md">
        <div className="flex-center mb-8">
          <div className="gradient-primary rounded-full p-3">
            <Mail className="icon-xl text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-2">
          Password Dimenticata?
        </h1>
        <p className="text-center text-neutral-600 mb-8">
          Inserisci la tua email e ti invieremo un link per reimpostare la password
        </p>

        {error && (
          <div className="card card-danger p-4 mb-4">
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email
            </label>
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

          <button
            type="submit"
            disabled={isLoading}
            className={`btn btn-primary btn-block btn-lg ${isLoading ? 'btn-loading' : ''}`}
          >
            {isLoading ? 'Invio in corso...' : 'Invia Link di Reset'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link 
            to="/login" 
            className="text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-2"
          >
            <ArrowLeft className="icon-sm" />
            Torna al Login
          </Link>
        </div>
      </div>
    </div>
  );
}
