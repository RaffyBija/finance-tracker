import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ChevronDown, ChevronUp } from 'lucide-react';

type Lang = 'it' | 'en';

const lastUpdated = '18 marzo 2026';
const lastUpdatedEn = 'March 18, 2026';
const contactEmail = 'privacy@tuodominio.com'; // ← sostituisci

// ── Contenuto ────────────────────────────────────────────────────────────────

const sections = {
  it: [
    {
      id: 'raccolta',
      title: '1. Raccolta e uso dei dati',
      content: `Finance Tracker raccoglie esclusivamente i dati necessari per fornire il servizio. In particolare:

**Dati forniti dall'utente:** nome, indirizzo email e password al momento della registrazione. Le password vengono archiviate in forma crittografata (hashing bcrypt) e non sono mai leggibili da noi.

**Dati finanziari:** le transazioni, le categorie, i budget e le spese ricorrenti che inserisci volontariamente nell'applicazione. Questi dati sono associati al tuo account e non vengono condivisi con terze parti.

**Dati di utilizzo:** non raccogliamo dati analitici comportamentali dettagliati. Utilizziamo Vercel Analytics per statistiche aggregate e anonime sul traffico (pagine visitate, provenienza geografica a livello di paese).

I tuoi dati vengono utilizzati esclusivamente per:
- Fornire e migliorare le funzionalità dell'applicazione
- Inviarti email transazionali (verifica account, reset password)
- Garantire la sicurezza del tuo account`,
    },
    {
      id: 'cookie',
      title: '2. Cookie e tracciamento',
      content: `Finance Tracker utilizza un numero minimo di cookie, tutti necessari al funzionamento del servizio.

**Cookie essenziali:** il token JWT di autenticazione viene memorizzato nel localStorage del tuo browser. Questo è strettamente necessario per mantenere la sessione attiva tra una visita e l'altra.

**Cookie analitici:** Vercel Analytics utilizza un cookie anonimo per contare le visite uniche. Questo cookie non contiene informazioni personali identificabili e non viene condiviso con piattaforme pubblicitarie.

**Cosa non usiamo:** non utilizziamo cookie di profilazione, remarketing, o tracciamento cross-site. Non integriamo pixel di Facebook, Google Ads, o strumenti analitici invasivi.

Puoi disabilitare i cookie dal tuo browser in qualsiasi momento, ma questo potrebbe impedire il corretto funzionamento dell'autenticazione.`,
    },
    {
      id: 'diritti',
      title: '3. Diritti dell\'utente',
      content: `In conformità al Regolamento Europeo sulla Protezione dei Dati (GDPR), hai i seguenti diritti sui tuoi dati personali:

**Diritto di accesso:** puoi richiedere in qualsiasi momento una copia dei dati personali che deteniamo su di te.

**Diritto di rettifica:** puoi modificare nome ed email direttamente dalla pagina Profilo dell'applicazione, senza necessità di contattarci.

**Diritto alla cancellazione:** puoi eliminare il tuo account e tutti i dati associati direttamente dalla sezione "Zona pericolosa" nella pagina Profilo. La cancellazione è immediata e irreversibile.

**Diritto alla portabilità:** puoi richiedere l'esportazione dei tuoi dati in formato leggibile (CSV/JSON) contattandoci all'indirizzo indicato nella sezione Contatti.

**Diritto di opposizione:** puoi opporti al trattamento dei tuoi dati per finalità diverse dall'erogazione del servizio contattandoci.

**Diritto di revoca del consenso:** puoi revocare il consenso al trattamento dei dati in qualsiasi momento eliminando il tuo account.`,
    },
    {
      id: 'sicurezza',
      title: '4. Sicurezza dei dati',
      content: `La sicurezza dei tuoi dati è una priorità. Adottiamo le seguenti misure tecniche e organizzative:

**Crittografia in transito:** tutte le comunicazioni tra il tuo browser e i nostri server avvengono tramite HTTPS con certificati TLS aggiornati.

**Crittografia delle password:** le password non vengono mai memorizzate in chiaro. Utilizziamo bcrypt con un fattore di costo adeguato per rendere computazionalmente impraticabile qualsiasi attacco di forza bruta.

**Autenticazione JWT:** i token di sessione hanno una scadenza di 7 giorni e vengono invalidati automaticamente. In caso di compromissione, puoi modificare la password dalla pagina Profilo per invalidare tutte le sessioni attive.

**Protezione API:** il backend implementa rate limiting sugli endpoint di autenticazione (massimo 10 tentativi ogni 15 minuti per IP) per prevenire attacchi di forza bruta. Sono presenti header di sicurezza HTTP (helmet) per proteggere da attacchi comuni.

**Infrastruttura:** l'applicazione è ospitata su Vercel (frontend) e Render (backend), provider con certificazioni SOC 2 e misure di sicurezza enterprise.

In caso di violazione dei dati che possa comportare un rischio per i tuoi diritti, ti notificheremo entro 72 ore come previsto dal GDPR.`,
    },
    {
      id: 'gdpr',
      title: '5. Conformità GDPR',
      content: `Finance Tracker è progettato nel rispetto del Regolamento (UE) 2016/679 (GDPR).

**Base giuridica del trattamento:** il trattamento dei tuoi dati si basa sul contratto che si instaura al momento della registrazione (Art. 6, par. 1, lett. b GDPR). Senza i dati essenziali (email, password) non è possibile creare un account o utilizzare il servizio.

**Titolare del trattamento:** il titolare del trattamento è il gestore del servizio Finance Tracker, contattabile all'indirizzo indicato nella sezione Contatti.

**Periodo di conservazione:** i tuoi dati vengono conservati fino all'eliminazione del tuo account. Non esistono periodi di retention prolungati: la cancellazione dell'account comporta la rimozione immediata di tutti i dati personali e finanziari dai nostri sistemi.

**Trasferimento internazionale dei dati:** i dati possono essere elaborati su server localizzati negli Stati Uniti (Vercel, Render). Entrambi i provider aderiscono al Data Privacy Framework UE-USA, garantendo un livello di protezione adeguato ai sensi del GDPR.

**Minori:** il servizio non è destinato a persone di età inferiore ai 18 anni. Non raccogliamo consapevolmente dati di minori.`,
    },
    {
      id: 'contatti',
      title: '6. Contatti',
      content: `Per qualsiasi domanda relativa a questa Privacy Policy, per esercitare i tuoi diritti o per segnalare un problema di sicurezza, puoi contattarci a:

📧 **${contactEmail}**

Ci impegniamo a rispondere entro 30 giorni dalla ricezione della richiesta, come previsto dal GDPR.

Hai anche il diritto di proporre reclamo all'Autorità Garante per la Protezione dei Dati Personali (www.garanteprivacy.it) se ritieni che il trattamento dei tuoi dati violi il GDPR.`,
    },
  ],
  en: [
    {
      id: 'raccolta',
      title: '1. Data Collection and Use',
      content: `Finance Tracker collects only the data necessary to provide the service. Specifically:

**User-provided data:** name, email address, and password at the time of registration. Passwords are stored in encrypted form (bcrypt hashing) and are never readable by us.

**Financial data:** transactions, categories, budgets, and recurring expenses that you voluntarily enter into the application. This data is associated with your account and is never shared with third parties.

**Usage data:** we do not collect detailed behavioral analytics. We use Vercel Analytics for aggregated, anonymous traffic statistics (pages visited, geographic origin at country level).

Your data is used exclusively to:
- Provide and improve application features
- Send you transactional emails (account verification, password reset)
- Ensure the security of your account`,
    },
    {
      id: 'cookie',
      title: '2. Cookies and Tracking',
      content: `Finance Tracker uses a minimum number of cookies, all necessary for the service to function.

**Essential cookies:** the JWT authentication token is stored in your browser's localStorage. This is strictly necessary to maintain an active session between visits.

**Analytics cookies:** Vercel Analytics uses an anonymous cookie to count unique visits. This cookie contains no personally identifiable information and is not shared with advertising platforms.

**What we don't use:** we do not use profiling, remarketing, or cross-site tracking cookies. We do not integrate Facebook pixels, Google Ads, or invasive analytics tools.

You can disable cookies from your browser at any time, but this may prevent authentication from working correctly.`,
    },
    {
      id: 'diritti',
      title: '3. User Rights',
      content: `In accordance with the European General Data Protection Regulation (GDPR), you have the following rights regarding your personal data:

**Right of access:** you can request a copy of the personal data we hold about you at any time.

**Right of rectification:** you can modify your name and email directly from the Profile page within the application, without needing to contact us.

**Right to erasure:** you can delete your account and all associated data directly from the "Danger Zone" section on the Profile page. Deletion is immediate and irreversible.

**Right to data portability:** you can request an export of your data in a readable format (CSV/JSON) by contacting us at the address in the Contacts section.

**Right to object:** you can object to the processing of your data for purposes other than service delivery by contacting us.

**Right to withdraw consent:** you can withdraw consent to data processing at any time by deleting your account.`,
    },
    {
      id: 'sicurezza',
      title: '4. Data Security',
      content: `The security of your data is a priority. We adopt the following technical and organizational measures:

**Encryption in transit:** all communications between your browser and our servers occur via HTTPS with up-to-date TLS certificates.

**Password encryption:** passwords are never stored in plain text. We use bcrypt with an appropriate cost factor to make any brute-force attack computationally impractical.

**JWT authentication:** session tokens expire after 7 days and are automatically invalidated. In case of compromise, you can change your password from the Profile page to invalidate all active sessions.

**API protection:** the backend implements rate limiting on authentication endpoints (maximum 10 attempts per 15 minutes per IP) to prevent brute-force attacks. HTTP security headers (helmet) are in place to protect against common attacks.

**Infrastructure:** the application is hosted on Vercel (frontend) and Render (backend), providers with SOC 2 certifications and enterprise security measures.

In case of a data breach that may pose a risk to your rights, we will notify you within 72 hours as required by the GDPR.`,
    },
    {
      id: 'gdpr',
      title: '5. GDPR Compliance',
      content: `Finance Tracker is designed in compliance with Regulation (EU) 2016/679 (GDPR).

**Legal basis for processing:** the processing of your data is based on the contract established at the time of registration (Art. 6, par. 1, lit. b GDPR). Without the essential data (email, password), it is not possible to create an account or use the service.

**Data controller:** the data controller is the Finance Tracker service operator, contactable at the address indicated in the Contacts section.

**Retention period:** your data is kept until your account is deleted. There are no extended retention periods: account deletion results in the immediate removal of all personal and financial data from our systems.

**International data transfers:** data may be processed on servers located in the United States (Vercel, Render). Both providers adhere to the EU-US Data Privacy Framework, ensuring an adequate level of protection under the GDPR.

**Minors:** the service is not intended for persons under the age of 18. We do not knowingly collect data from minors.`,
    },
    {
      id: 'contatti',
      title: '6. Contacts',
      content: `For any questions regarding this Privacy Policy, to exercise your rights, or to report a security issue, you can contact us at:

📧 **${contactEmail}**

We are committed to responding within 30 days of receiving your request, as required by the GDPR.

You also have the right to lodge a complaint with your local data protection authority if you believe that the processing of your data violates the GDPR.`,
    },
  ],
};

const ui = {
  it: {
    title: 'Privacy Policy',
    subtitle: 'Come raccogliamo, utilizziamo e proteggiamo i tuoi dati',
    updated: `Ultimo aggiornamento: ${lastUpdated}`,
    backHome: 'Torna alla home',
    tocTitle: 'Indice',
    selectSection: 'Vai alla sezione...',
  },
  en: {
    title: 'Privacy Policy',
    subtitle: 'How we collect, use, and protect your data',
    updated: `Last updated: ${lastUpdatedEn}`,
    backHome: 'Back to home',
    tocTitle: 'Contents',
    selectSection: 'Go to section...',
  },
};

// ── Renderer testo con bold ───────────────────────────────────────────────────

function RenderContent({ text }: { text: string }) {
  return (
    <div className="space-y-3">
      {text.split('\n\n').map((paragraph, i) => {
        if (!paragraph.trim()) return null;

        // Lista puntata
        if (paragraph.startsWith('- ')) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 text-neutral-700">
              {paragraph.split('\n').map((line, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  {renderInline(line.replace(/^- /, ''))}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-sm leading-relaxed text-neutral-700">
            {renderInline(paragraph)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold text-neutral-900">{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// ── Componente principale ─────────────────────────────────────────────────────

export const Privacy = () => {
  const [lang, setLang] = useState<Lang>('it');
  const [activeSection, setActiveSection] = useState('raccolta');
  const [mobileOpen, setMobileOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const t = ui[lang];
  const content = sections[lang];

  // Scroll spy — aggiorna la sezione attiva mentre si scorre
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [lang]);

  const scrollTo = (id: string) => {
    setActiveSection(id);
    setMobileOpen(false);
    const el = sectionRefs.current[id];
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-neutral-700 hover:text-primary-600 transition-colors">
            <div className="bg-primary-600 rounded-lg p-1.5">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Finance Tracker</span>
          </Link>

          {/* Lang toggle */}
          <div className="flex items-center gap-1 bg-neutral-100 rounded-full p-1">
            {(['it', 'en'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                  lang === l
                    ? 'bg-white text-primary-700 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{t.title}</h1>
          <p className="text-neutral-500 mb-3">{t.subtitle}</p>
          <span className="inline-block text-xs text-neutral-400 bg-neutral-100 rounded-full px-3 py-1">
            {t.updated}
          </span>
        </div>
      </div>

      {/* ── Mobile: indice a tendina ── */}
      <div className="lg:hidden sticky top-14 z-30 bg-white border-b border-neutral-200 shadow-sm">
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700"
        >
          <span>{content.find((s) => s.id === activeSection)?.title ?? t.tocTitle}</span>
          {mobileOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {mobileOpen && (
          <div className="border-t border-neutral-100 bg-white">
            {content.map((s) => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  activeSection === s.id
                    ? 'text-primary-700 bg-primary-50 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Layout principale ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex gap-10">

          {/* ── Sidebar desktop ── */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                {t.tocTitle}
              </p>
              <nav className="space-y-1">
                {content.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSection === s.id
                        ? 'bg-primary-50 text-primary-700 font-medium border-l-2 border-primary-500 pl-2.5'
                        : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Contenuto ── */}
          <main className="flex-1 min-w-0 space-y-12">
            {content.map((s) => (
              <section
                key={s.id}
                id={s.id}
                ref={(el) => { sectionRefs.current[s.id] = el; }}
                className="scroll-mt-28"
              >
                <div className="bg-white rounded-xl border border-neutral-200 p-6 sm:p-8">
                  <h2 className="text-lg font-semibold text-neutral-900 mb-5 pb-4 border-b border-neutral-100">
                    {s.title}
                  </h2>
                  <RenderContent text={s.content} />
                </div>
              </section>
            ))}

            {/* Footer pagina */}
            <div className="text-center pb-8">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                ← {t.backHome}
              </Link>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
};