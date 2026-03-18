import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useFormValidation } from '../hooks/useFormValidation';
import FieldError from '../components/shared/FieldError';
import { User, Lock, Trash2, ChevronRight, ShieldAlert } from 'lucide-react';

// ── Sezione: Dati Account ────────────────────────────────────────────────────

function AccountSection() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [emailChangePending, setEmailChangePending] = useState(false); 
  const [pendingEmailAddress, setPendingEmailAddress] = useState('');  

  const [formData, setFormData] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
  });

  const { errors, validate, clearError } = useFormValidation({
    name: (v: string) => {
      if (!v?.trim()) return 'Il nome è obbligatorio';
      if (v.trim().length < 2) return 'Minimo 2 caratteri';
      if (v.trim().length > 50) return 'Massimo 50 caratteri';
      return null;
    },
    email: (v: string) => {
      if (!v?.trim()) return "L'email è obbligatoria";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email non valida';
      return null;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return;

    const unchanged = formData.name === user?.name && formData.email === user?.email;
    if (unchanged) {
      toast.info('Nessuna modifica apportata');
      setIsEditing(false);
      return;
    }

    setIsPending(true);
    try {
      const res = await authAPI.updateProfile(formData);

      // Aggiorna il nome subito nel context
      updateUser(res.user ?? res);

      if (res.emailChangeRequested) {
        // Email non aggiornata subito — in attesa di verifica
        setEmailChangePending(true);
        setPendingEmailAddress(formData.email);
        toast.info(res.message);
      } else {
        toast.success(res.message || 'Profilo aggiornato con successo');
      }
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel salvataggio');
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: user?.name ?? '', email: user?.email ?? '' });
    setIsEditing(false);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
          <User className="icon-md text-primary-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Dati account</h2>
          <p className="text-sm text-neutral-500">Nome e indirizzo email</p>
        </div>
      </div>

      {!isEditing ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center py-3 border-b border-neutral-100">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Nome</p>
              <p className="font-medium text-neutral-900">{user?.name}</p>
            </div>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-neutral-100">
            <div>
              <p className="text-xs text-neutral-500 mb-0.5">Email</p>
              <p className="font-medium text-neutral-900">{user?.email}</p>
            </div>
          </div>
          {emailChangePending && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <p className="text-sm font-medium text-warning-800 mb-1">
                Verifica in attesa
              </p>
              <p className="text-sm text-warning-700">
                Abbiamo inviato un link di conferma a{' '}
                <span className="font-semibold">{pendingEmailAddress}</span>.
                La tua email attuale rimane invariata fino al click sul link.
              </p>
            </div>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-outline-primary btn-md mt-2"
          >
            Modifica dati
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearError('name'); }}
              className={`form-input ${errors.name ? 'form-input-error' : ''}`}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError('email'); }}
              className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            />
            <FieldError message={errors.email} />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-md">
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sezione: Sicurezza ───────────────────────────────────────────────────────

function SecuritySection() {
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const { errors, validate, clearError, resetErrors } = useFormValidation({
    currentPassword: (v: string) => {
      if (!v) return 'Inserisci la password attuale';
      return null;
    },
    newPassword: (v: string, form: typeof formData) => {
      if (!v) return 'Inserisci la nuova password';
      if (v.length < 8) return 'Minimo 8 caratteri';
      if (v === form.currentPassword) return 'La nuova password deve essere diversa da quella attuale';
      return null;
    },
    confirmPassword: (v: string, form: typeof formData) => {
      if (!v) return 'Conferma la nuova password';
      if (v !== form.newPassword) return 'Le password non corrispondono';
      return null;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(formData)) return;

    setIsPending(true);
    try {
      await authAPI.changePassword(formData);
      toast.success('Password aggiornata con successo');
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      resetErrors();
      setIsOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel cambio password');
    } finally {
      setIsPending(false);
    }
  };

  const handleCancel = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    resetErrors();
    setIsOpen(false);
  };

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
          <Lock className="icon-md text-success-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Sicurezza</h2>
          <p className="text-sm text-neutral-500">Gestione password</p>
        </div>
      </div>

      {!isOpen ? (
        <div className="flex justify-between items-center py-3 border-b border-neutral-100">
          <div>
            <p className="text-xs text-neutral-500 mb-0.5">Password</p>
            <p className="font-medium text-neutral-900">••••••••</p>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="btn btn-outline-primary btn-sm flex items-center gap-1"
          >
            Modifica <ChevronRight className="icon-sm" />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Password attuale</label>
            <input
              type="password"
              value={formData.currentPassword}
              onChange={(e) => { setFormData({ ...formData, currentPassword: e.target.value }); clearError('currentPassword'); }}
              className={`form-input ${errors.currentPassword ? 'form-input-error' : ''}`}
              placeholder="••••••••"
            />
            <FieldError message={errors.currentPassword} />
          </div>

          <div className="form-group">
            <label className="form-label">Nuova password</label>
            <input
              type="password"
              value={formData.newPassword}
              onChange={(e) => { setFormData({ ...formData, newPassword: e.target.value }); clearError('newPassword'); }}
              className={`form-input ${errors.newPassword ? 'form-input-error' : ''}`}
              placeholder="Minimo 8 caratteri"
            />
            <FieldError message={errors.newPassword} />
          </div>

          <div className="form-group">
            <label className="form-label">Conferma nuova password</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => { setFormData({ ...formData, confirmPassword: e.target.value }); clearError('confirmPassword'); }}
              className={`form-input ${errors.confirmPassword ? 'form-input-error' : ''}`}
              placeholder="••••••••"
            />
            <FieldError message={errors.confirmPassword} />
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending ? 'Aggiornamento...' : 'Aggiorna password'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-md">
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sezione: Zona pericolosa ─────────────────────────────────────────────────

function DangerZoneSection() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmEmail.trim()) {
      setEmailError('Inserisci la tua email per confermare');
      return;
    }
    if (confirmEmail.toLowerCase().trim() !== user?.email?.toLowerCase()) {
      setEmailError('Email non corretta');
      return;
    }

    setIsPending(true);
    try {
      await authAPI.deleteAccount(confirmEmail);
      toast.success('Account eliminato');
      logout();
      navigate('/');
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Errore nell'eliminazione dell'account");
      setIsPending(false);
    }
  };

  return (
    <div className="card p-6 border-danger-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-danger-100 flex items-center justify-center flex-shrink-0">
          <ShieldAlert className="icon-md text-danger-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-danger-700">Zona pericolosa</h2>
          <p className="text-sm text-neutral-500">Azioni irreversibili sull'account</p>
        </div>
      </div>

      {!isOpen ? (
        <div className="flex items-center justify-between py-3 border-b border-neutral-100">
          <div>
            <p className="font-medium text-neutral-900">Elimina account</p>
            <p className="text-sm text-neutral-500 mt-0.5">
              Tutti i tuoi dati verranno eliminati definitivamente
            </p>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="btn btn-sm flex items-center gap-1 text-danger-600 border border-danger-200 hover:bg-danger-50 rounded-lg px-3 py-1.5"
          >
            <Trash2 className="icon-sm" />
            Elimina
          </button>
        </div>
      ) : (
        <form onSubmit={handleDelete} className="space-y-4">
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
            <p className="text-sm text-danger-800 font-medium mb-1">Questa azione è irreversibile</p>
            <p className="text-sm text-danger-700">
              Verranno eliminati permanentemente tutti i tuoi dati: transazioni, categorie, budget e impostazioni.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Scrivi <span className="font-semibold text-neutral-900">{user?.email}</span> per confermare
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => { setConfirmEmail(e.target.value); setEmailError(''); }}
              className={`form-input ${emailError ? 'form-input-error' : ''}`}
              placeholder="La tua email"
            />
            <FieldError message={emailError} />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="btn btn-md bg-danger-600 text-white hover:bg-danger-700 disabled:opacity-50"
            >
              {isPending ? 'Eliminazione...' : 'Elimina account definitivamente'}
            </button>
            <button
              type="button"
              onClick={() => { setIsOpen(false); setConfirmEmail(''); setEmailError(''); }}
              className="btn btn-secondary btn-md"
            >
              Annulla
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Pagina principale ────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user } = useAuth();

  // Genera le iniziali per l'avatar
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="container-custom">
      {/* Header pagina */}
      <div className="page-header mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-white">{initials}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{user?.name}</h1>
            <p className="text-sm text-neutral-500">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Sezioni */}
      <div className="space-y-6">
        <AccountSection />
        <SecuritySection />
        <DangerZoneSection />
      </div>
    </div>
  );
}