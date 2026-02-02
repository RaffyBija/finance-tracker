import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, CheckCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Pagina per reimpostare la password con token
 * Riceve token da URL query params
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setError('Token mancante o non valido');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validazione password
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
      await axios.post(`${API_URL}/auth/reset-password`, {
        token,
        newPassword: password,
      });
      setSuccess(true);
      
      // Redirect dopo 3 secondi
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il reset della password');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
        <div className="card card-xl w-full max-w-md text-center">
          <div className="flex-center mb-6">
            <div className="bg-success-100 rounded-full p-4">
              <CheckCircle className="icon-2xl text-success-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-neutral-800 mb-3">
            Password Reimpostata!
          </h1>
          
          <p className="text-neutral-600 mb-6">
            La tua password è stata reimpostata con successo.
            Verrai reindirizzato alla pagina di login...
          </p>

          <Link to="/login" className="btn btn-primary btn-block">
            Vai al Login
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
            <Lock className="icon-xl text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-2">
          Reimposta Password
        </h1>
        <p className="text-center text-neutral-600 mb-8">
          Inserisci la tua nuova password
        </p>

        {error && (
          <div className="card card-danger p-4 mb-4">
            <p className="text-sm text-danger-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Nuova Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
              disabled={isLoading || !token}
              minLength={6}
            />
            <p className="form-help">Minimo 6 caratteri</p>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              Conferma Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
              disabled={isLoading || !token}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !token}
            className={`btn btn-primary btn-block btn-lg ${isLoading ? 'btn-loading' : ''}`}
          >
            {isLoading ? 'Salvataggio...' : 'Reimposta Password'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link 
            to="/login" 
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Torna al Login
          </Link>
        </div>
      </div>
    </div>
  );
}
