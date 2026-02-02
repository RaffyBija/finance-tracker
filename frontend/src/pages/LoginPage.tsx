import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante il login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex-center p-4">
      <div className="card card-xl w-full max-w-md">
        <div className="flex-center mb-8">
          <div className="gradient-primary rounded-full p-3">
            <LogIn className="icon-xl text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-neutral-800 mb-2">
          Benvenuto
        </h1>
        <p className="text-center text-neutral-600 mb-8">
          Accedi al tuo account
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
            />
          </div>

          <div className="form-group">
            <div className="flex-between mb-2">
              <label htmlFor="password" className="form-label mb-0">
                Password
              </label>
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Password dimenticata?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`btn btn-primary btn-block btn-lg ${isLoading ? 'btn-loading' : ''}`}
          >
            {isLoading ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        <p className="text-center text-neutral-600 mt-6">
          Non hai un account?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}