import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import { authAPI } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useFormValidation } from '../hooks/useFormValidation';
import FieldError from '../components/shared/FieldError';
import {
  User, SlidersHorizontal, Lock, FileText, Sparkles, Trash2,
  ChevronLeft, ChevronRight, Check, Sun, Moon, Monitor,
} from 'lucide-react';
import { CURRENCY_OPTIONS } from '../utils/currency';

// ── Sezione: Generale (identità + dati account) ──────────────────────────────

function GeneralSection() {
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

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

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
      updateUser(res.user ?? res);

      if (res.emailChangeRequested) {
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
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title">Generale</h2>
        <p className="settings-section-desc">Le informazioni del tuo profilo.</p>
      </div>

      <div className="settings-identity">
        <div className="settings-avatar">{initials}</div>
        <div className="settings-identity-meta">
          <div className="settings-identity-name-row">
            <span className="settings-identity-name">{user?.name}</span>
            {user?.isPro && <span className="pro-badge">PRO</span>}
          </div>
          <span className="settings-identity-email">{user?.email}</span>
        </div>
      </div>

      {!isEditing ? (
        <div className="settings-fields">
          <div className="settings-field">
            <span className="settings-field-label">Nome</span>
            <span className="settings-field-value">{user?.name}</span>
          </div>
          <div className="settings-field">
            <span className="settings-field-label">Email</span>
            <span className="settings-field-value">{user?.email}</span>
          </div>

          {emailChangePending && (
            <div className="settings-notice settings-notice-warning">
              <p className="settings-notice-title">Verifica in attesa</p>
              <p className="settings-notice-text">
                Abbiamo inviato un link di conferma a{' '}
                <strong>{pendingEmailAddress}</strong>. La tua email attuale resta
                invariata fino al click sul link.
              </p>
            </div>
          )}

          <div className="settings-actions">
            <button onClick={() => setIsEditing(true)} className="btn btn-primary btn-md">
              Modifica dati
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearError('name'); }}
              className={`form-input${errors.name ? ' form-input-error' : ''}`}
            />
            <FieldError message={errors.name} />
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError('email'); }}
              className={`form-input${errors.email ? ' form-input-error' : ''}`}
            />
            <FieldError message={errors.email} />
          </div>

          <div className="settings-actions">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-md">
              Annulla
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// ── Sezione: Preferenze (tema + valuta) ──────────────────────────────────────

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ElementType }[] = [
  { value: 'light',  label: 'Chiaro',  icon: Sun     },
  { value: 'dark',   label: 'Scuro',   icon: Moon    },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function PreferencesSection() {
  const { user, updateUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);

  const handleCurrencyChange = async (currency: string) => {
    if (currency === user?.currency) return;
    setIsPending(true);
    try {
      const res = await authAPI.updateProfile({ currency });
      updateUser(res.user ?? res);
      toast.success('Valuta aggiornata');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Errore nel salvataggio');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title">Preferenze</h2>
        <p className="settings-section-desc">Aspetto e formato dell'app.</p>
      </div>

      <div className="settings-pref">
        <div className="settings-pref-text">
          <span className="settings-pref-title">Tema</span>
          <span className="settings-pref-desc">Scegli l'aspetto o segui il sistema.</span>
        </div>
        <div className="theme-seg" role="group" aria-label="Tema">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreference(value)}
              className={`theme-seg-option${preference === value ? ' is-selected' : ''}`}
              aria-pressed={preference === value}
            >
              <Icon size={15} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="settings-divider" />

      <div className="settings-pref settings-pref-stack">
        <div className="settings-pref-text">
          <span className="settings-pref-title">Valuta</span>
          <span className="settings-pref-desc">Simbolo e formato degli importi, ovunque.</span>
        </div>
        <div className="settings-pref-control">
          <select
            className="form-select"
            value={user?.currency ?? 'EUR'}
            onChange={(e) => handleCurrencyChange(e.target.value)}
            disabled={isPending}
            aria-label="Valuta"
            aria-busy={isPending}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {isPending && (
            <span className="settings-pref-status" role="status">
              <span className="settings-spinner" aria-hidden="true" />
              Salvataggio…
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sezione: Sicurezza (password) ────────────────────────────────────────────

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
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title">Sicurezza</h2>
        <p className="settings-section-desc">Gestisci la password del tuo account.</p>
      </div>

      {!isOpen ? (
        <div className="settings-fields">
          <div className="settings-field">
            <span className="settings-field-label">Password</span>
            <span className="settings-field-value">••••••••</span>
          </div>
          <div className="settings-actions">
            <button onClick={() => setIsOpen(true)} className="btn btn-primary btn-md">
              Cambia password
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="settings-form">
          <div className="form-group">
            <label className="form-label">Password attuale</label>
            <input
              type="password"
              value={formData.currentPassword}
              onChange={(e) => { setFormData({ ...formData, currentPassword: e.target.value }); clearError('currentPassword'); }}
              className={`form-input${errors.currentPassword ? ' form-input-error' : ''}`}
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
              className={`form-input${errors.newPassword ? ' form-input-error' : ''}`}
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
              className={`form-input${errors.confirmPassword ? ' form-input-error' : ''}`}
              placeholder="••••••••"
            />
            <FieldError message={errors.confirmPassword} />
          </div>

          <div className="settings-actions">
            <button type="submit" disabled={isPending} className="btn btn-primary btn-md">
              {isPending ? 'Aggiornamento...' : 'Aggiorna password'}
            </button>
            <button type="button" onClick={handleCancel} className="btn btn-secondary btn-md">
              Annulla
            </button>
          </div>
        </form>
      )}
    </>
  );
}

// ── Sezione: Privacy ─────────────────────────────────────────────────────────

function PrivacySection() {
  const navigate = useNavigate();

  return (
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title">Privacy</h2>
        <p className="settings-section-desc">Come trattiamo e proteggiamo i tuoi dati.</p>
      </div>

      <button onClick={() => navigate('/privacy')} className="settings-link-row">
        <span className="settings-link-row-main">
          <FileText size={17} className="settings-link-row-icon" />
          <span>
            <span className="settings-link-row-title">Informativa sulla privacy</span>
            <span className="settings-link-row-desc">Leggi la policy completa</span>
          </span>
        </span>
        <ChevronRight size={16} className="settings-link-row-chevron" />
      </button>
    </>
  );
}

// ── Sezione: Piano ───────────────────────────────────────────────────────────

function PlanSection() {
  const { user } = useAuth();
  const isPro = user?.isPro ?? false;

  return (
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title">Piano</h2>
        <p className="settings-section-desc">Il tuo abbonamento e i relativi limiti.</p>
      </div>

      <div className="plan-badge-row">
        {isPro
          ? <span className="pro-badge pro-badge-lg">PRO</span>
          : <span className="plan-standard-badge">Standard</span>
        }
        <span className="plan-status-label">
          {isPro ? 'Account Pro attivo' : 'Piano gratuito'}
        </span>
      </div>

      <div className="plan-limits">
        <div className="plan-limit-item">
          <Check size={14} className="plan-limit-check" />
          <span>Conti bancari / carte: fino a {isPro ? '10' : '3'}</span>
        </div>
        <div className="plan-limit-item">
          <Check size={14} className="plan-limit-check" />
          <span>Transazioni illimitate</span>
        </div>
        <div className="plan-limit-item">
          <Check size={14} className="plan-limit-check" />
          <span>Budget, ricorrenti e pianificate illimitati</span>
        </div>
        {isPro && (
          <div className="plan-limit-item">
            <Check size={14} className="plan-limit-check" />
            <span>Accesso anticipato alle nuove funzionalità</span>
          </div>
        )}
      </div>

      {!isPro && (
        <div className="plan-upgrade">
          <div className="plan-upgrade-content">
            <Sparkles size={16} className="plan-upgrade-icon" />
            <div>
              <p className="plan-upgrade-title">Passa a Pro</p>
              <p className="plan-upgrade-desc">Fino a 10 conti e accesso anticipato alle prossime funzionalità.</p>
            </div>
          </div>
          <span className="plan-upgrade-soon">In arrivo</span>
        </div>
      )}
    </>
  );
}

// ── Sezione: Elimina account ─────────────────────────────────────────────────

function DangerSection() {
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
    <>
      <div className="settings-section-head">
        <h2 className="settings-section-title settings-section-title-danger">Elimina account</h2>
        <p className="settings-section-desc">Azione irreversibile su tutti i tuoi dati.</p>
      </div>

      {!isOpen ? (
        <div className="settings-fields">
          <div className="settings-notice settings-notice-danger">
            <p className="settings-notice-title">Eliminazione definitiva</p>
            <p className="settings-notice-text">
              Verranno rimossi permanentemente transazioni, categorie, budget e impostazioni.
              Non è possibile annullare.
            </p>
          </div>
          <div className="settings-actions">
            <button onClick={() => setIsOpen(true)} className="btn btn-danger btn-md">
              <Trash2 size={15} />
              Elimina account
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleDelete} className="settings-form">
          <div className="settings-notice settings-notice-danger">
            <p className="settings-notice-title">Questa azione è irreversibile</p>
            <p className="settings-notice-text">
              Verranno eliminati permanentemente tutti i tuoi dati: transazioni, categorie,
              budget e impostazioni.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              Scrivi <strong>{user?.email}</strong> per confermare
            </label>
            <input
              type="email"
              value={confirmEmail}
              onChange={(e) => { setConfirmEmail(e.target.value); setEmailError(''); }}
              className={`form-input${emailError ? ' form-input-error' : ''}`}
              placeholder="La tua email"
            />
            <FieldError message={emailError} />
          </div>

          <div className="settings-actions">
            <button type="submit" disabled={isPending} className="btn btn-danger btn-md">
              {isPending ? 'Eliminazione...' : 'Elimina definitivamente'}
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
    </>
  );
}

// ── Pagina principale ────────────────────────────────────────────────────────

type SectionId = 'generale' | 'preferenze' | 'sicurezza' | 'privacy' | 'piano' | 'elimina';

const NAV: { id: SectionId; label: string; icon: React.ElementType; danger?: boolean }[] = [
  { id: 'generale',   label: 'Generale',        icon: User             },
  { id: 'preferenze', label: 'Preferenze',      icon: SlidersHorizontal },
  { id: 'sicurezza',  label: 'Sicurezza',       icon: Lock             },
  { id: 'privacy',    label: 'Privacy',         icon: FileText         },
  { id: 'piano',      label: 'Piano',           icon: Sparkles         },
  { id: 'elimina',    label: 'Elimina account', icon: Trash2, danger: true },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();

  // La sezione attiva vive nell'URL (`/profile#sicurezza`): deep-link
  // condivisibili, back/forward del browser e refresh la conservano.
  const hash = location.hash.replace(/^#/, '');
  const isSection = NAV.some((n) => n.id === hash);
  const active: SectionId = isSection ? (hash as SectionId) : 'generale';
  // Su mobile (master-detail) l'hash distingue la lista dal dettaglio.
  const mobileDetail = isSection;

  const open = (id: SectionId) => navigate(`/profile#${id}`);

  return (
    <div className="container-custom settings-page">
      <div className="settings-header">
        <h1 className="settings-title">Impostazioni</h1>
      </div>

      <div className={`settings-layout${mobileDetail ? ' is-detail' : ''}`}>
        <nav className="settings-nav" aria-label="Sezioni impostazioni">
          {NAV.map(({ id, label, icon: Icon, danger }) => (
            <button
              key={id}
              onClick={() => open(id)}
              className={`settings-nav-item${active === id ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
              aria-current={active === id ? 'page' : undefined}
            >
              <Icon size={17} className="settings-nav-item-icon" />
              <span>{label}</span>
              <ChevronRight size={15} className="settings-nav-item-chevron" />
            </button>
          ))}
        </nav>

        <section className="settings-panel">
          <button
            onClick={() => navigate('/profile')}
            className="settings-back"
          >
            <ChevronLeft size={16} />
            Impostazioni
          </button>

          {active === 'generale'   && <GeneralSection />}
          {active === 'preferenze' && <PreferencesSection />}
          {active === 'sicurezza'  && <SecuritySection />}
          {active === 'privacy'    && <PrivacySection />}
          {active === 'piano'      && <PlanSection />}
          {active === 'elimina'    && <DangerSection />}
        </section>
      </div>
    </div>
  );
}
