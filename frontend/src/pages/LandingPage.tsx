import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, ArrowLeftRight, Target, RefreshCw, Calendar, TrendingUp } from 'lucide-react';

type Lang = 'it' | 'en';

const FEATURE_ICONS = [BarChart2, ArrowLeftRight, Target, RefreshCw, Calendar, TrendingUp];

const MOCK_STAT_COLORS = ['#10b981', '#ef4444', '#0d9488', '#0f172a'];
const MOCK_DONUT_COLORS = ['#0d9488', '#10b981', '#f59e0b', '#ef4444'];
const DONUT_OFFSETS = [25, -10, -35, -55];
const DONUT_ARRAYS = ['35 65', '25 75', '20 80', '15 85'];
const DONUT_PCTS = ['35%', '25%', '20%', '15%'];

const barHeights = [55, 40, 70, 50, 60, 45, 80, 55, 65, 48, 90, 60];

const t = {
  it: {
    badge: 'Gratuito · Nessuna carta richiesta',
    heroTitle1: 'Prendi il controllo',
    heroTitle2: 'delle tue',
    heroTitleAccent: 'finanze personali',
    heroSub: "Traccia entrate e uscite, gestisci budget, pianifica spese future e visualizza trend mensili — tutto in un'unica dashboard intuitiva.",
    heroCta: 'Inizia subito, è gratis',
    heroCtaSecondary: 'Scopri le funzionalità',
    featuresEyebrow: 'Funzionalità',
    featuresTitle1: 'Tutto ciò che ti serve,',
    featuresTitle2: 'niente di superfluo',
    featuresSub: 'Progettato per chi vuole chiarezza sulle proprie finanze senza complessità inutili.',
    features: [
      { title: 'Dashboard in tempo reale', desc: 'Panoramica istantanea di entrate, uscite, saldo e andamento mensile con grafici interattivi.' },
      { title: 'Gestione transazioni', desc: 'Registra e categorizza ogni movimento economico. Filtra, cerca e analizza la tua spesa.' },
      { title: 'Budget personalizzati', desc: 'Imposta budget settimanali, mensili o annuali per categoria e monitora quanto hai speso.' },
      { title: 'Transazioni ricorrenti', desc: "Automatizza abbonamenti, affitti e stipendi. Finance Tracker li include nel calcolo del saldo futuro." },
      { title: 'Spese pianificate', desc: "Inserisci spese future come vacanze o acquisti importanti e visualizza l'impatto sul tuo saldo." },
      { title: 'Proiezione del saldo', desc: 'Scopri come sarà il tuo saldo nei prossimi mesi includendo ricorrenti e pianificate automaticamente.' },
    ],
    ctaBannerTitle1: 'Inizia oggi a gestire',
    ctaBannerTitle2: 'le tue finanze',
    ctaBannerSub: 'Registrati in pochi secondi, gratis e senza carta di credito.',
    ctaBannerBtn: 'Crea il tuo account →',
    navSignIn: 'Accedi',
    navCta: 'Inizia gratis →',
    footerDesc: 'Il tuo strumento personale per gestire le finanze quotidiane con semplicità e chiarezza.',
    footerApp: 'App',
    footerLegal: 'Legale',
    footerSignIn: 'Accedi',
    footerRegister: 'Registrati',
    footerFeatures: 'Funzionalità',
    demoLabel: "// Anteprima dell'interfaccia",
    mockPeriod: 'Marzo 2026',
    mockIncome: 'Entrate',
    mockExpense: 'Uscite',
    mockBalance: 'Saldo',
    mockTx: 'Transazioni',
    mockTrend: 'Trend mensile',
    mockCategory: 'Per categoria',
    mockRecent: 'Transazioni recenti',
    mockMonths: ['Ott', 'Nov', 'Dic', 'Gen', 'Feb', 'Mar'],
    mockNav: ['Dashboard', 'Transazioni', 'Budget', 'Categorie', 'Ricorrenti', 'Pianificati'],
    mockLegend: ['Affitto', 'Stipendio', 'Spesa', 'Altro'],
    mockTxItems: [
      { icon: '🏠', bg: '#f0fdfa', name: 'Affitto',       date: '1 Mar',  amount: '−€850,00',   pos: false },
      { icon: '💼', bg: '#f0fdf4', name: 'Stipendio',     date: '28 Feb', amount: '+€2.400,00',  pos: true  },
      { icon: '🛒', bg: '#fefce8', name: 'Supermercato',  date: '27 Feb', amount: '−€124,50',    pos: false },
    ],
  },
  en: {
    badge: 'Free · No credit card required',
    heroTitle1: 'Take control of',
    heroTitle2: 'your',
    heroTitleAccent: 'personal finances',
    heroSub: 'Track income and expenses, manage budgets, plan future transactions and visualize monthly trends — all in one intuitive dashboard.',
    heroCta: 'Start for free',
    heroCtaSecondary: 'Explore features',
    featuresEyebrow: 'Features',
    featuresTitle1: 'Everything you need,',
    featuresTitle2: "nothing you don't",
    featuresSub: 'Designed for those who want clarity on their finances without unnecessary complexity.',
    features: [
      { title: 'Real-time Dashboard',       desc: 'Instant overview of income, expenses, balance and monthly trends with interactive charts.' },
      { title: 'Transaction Management',    desc: 'Record and categorize every financial transaction. Filter, search and analyze your spending.' },
      { title: 'Custom Budgets',            desc: "Set weekly, monthly or yearly budgets by category and track how much you've spent." },
      { title: 'Recurring Transactions',    desc: 'Automate subscriptions, rent and salaries. Finance Tracker includes them in future balance calculations.' },
      { title: 'Planned Expenses',          desc: 'Add future expenses like holidays or big purchases and visualize their impact on your balance.' },
      { title: 'Balance Projection',        desc: 'See what your balance will look like in the coming months, including recurring and planned transactions.' },
    ],
    ctaBannerTitle1: 'Start managing your',
    ctaBannerTitle2: 'finances today',
    ctaBannerSub: 'Sign up in seconds, free and no credit card needed.',
    ctaBannerBtn: 'Create your account →',
    navSignIn: 'Sign in',
    navCta: 'Get started →',
    footerDesc: 'Your personal tool to manage daily finances with simplicity and clarity.',
    footerApp: 'App',
    footerLegal: 'Legal',
    footerSignIn: 'Sign in',
    footerRegister: 'Register',
    footerFeatures: 'Features',
    demoLabel: '// Interface preview',
    mockPeriod: 'March 2026',
    mockIncome: 'Income',
    mockExpense: 'Expenses',
    mockBalance: 'Balance',
    mockTx: 'Transactions',
    mockTrend: 'Monthly trend',
    mockCategory: 'By category',
    mockRecent: 'Recent transactions',
    mockMonths: ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
    mockNav: ['Dashboard', 'Transactions', 'Categories', 'Budget', 'Recurring', 'Planned'],
    mockLegend: ['Rent', 'Salary', 'Groceries', 'Other'],
    mockTxItems: [
      { icon: '🏠', bg: '#f0fdfa', name: 'Rent',       date: '1 Mar',  amount: '−€850.00',   pos: false },
      { icon: '💼', bg: '#f0fdf4', name: 'Salary',     date: 'Feb 28', amount: '+€2,400.00',  pos: true  },
      { icon: '🛒', bg: '#fefce8', name: 'Groceries',  date: 'Feb 27', amount: '−€124.50',    pos: false },
    ],
  },
};

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>('it');
  const [scrolled, setScrolled] = useState(false);
  const [mockVisible, setMockVisible] = useState(false);
  const [visibleFeatures, setVisibleFeatures] = useState<boolean[]>(new Array(6).fill(false));
  const mockRef = useRef<HTMLDivElement>(null);
  const featureRefs = useRef<(HTMLDivElement | null)[]>([]);
  const l = t[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    // Fallback: show mock browser after 600ms regardless of scroll
    const fallback = setTimeout(() => setMockVisible(true), 600);
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setMockVisible(true); clearTimeout(fallback); } },
      { threshold: 0, rootMargin: '0px 0px -10% 0px' },
    );
    if (mockRef.current) obs.observe(mockRef.current);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);

  useEffect(() => {
    // Fallback: show all features after 1.2s regardless of scroll
    const fallback = setTimeout(() => setVisibleFeatures(new Array(6).fill(true)), 1200);
    const observers = featureRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleFeatures(prev => {
              const next = [...prev];
              next[i] = true;
              return next;
            });
          }
        },
        { threshold: 0, rootMargin: '0px 0px -5% 0px' },
      );
      obs.observe(el);
      return obs;
    });
    return () => { observers.forEach(o => o?.disconnect()); clearTimeout(fallback); };
  }, []);

  return (
    <div className="landing-root">

      {/* Lang Toggle */}
      <div className="landing-lang-toggle">
        {(['it', 'en'] as Lang[]).map(code => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`landing-lang-btn${lang === code ? ' is-active' : ''}`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Navbar */}
      <nav className={`landing-nav${scrolled ? ' is-scrolled' : ''}`}>
        <a href="#" className="landing-wordmark">Finance Tracker</a>
        <div className="landing-nav-links">
          <Link to="/login" className="landing-btn-ghost landing-nav-ghost">{l.navSignIn}</Link>
          <Link to="/register" className="landing-btn-primary">{l.navCta}</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge landing-anim-1">{l.badge}</div>
          <h1 className="landing-hero-title landing-anim-2">
            {l.heroTitle1}<br />{l.heroTitle2}{' '}
            <span className="landing-hero-accent">{l.heroTitleAccent}</span>
          </h1>
          <p className="landing-hero-sub landing-anim-3">{l.heroSub}</p>
          <div className="landing-hero-ctas landing-anim-4">
            <Link to="/register" className="landing-btn-primary landing-btn-primary-lg">
              {l.heroCta}
            </Link>
            <a href="#features" className="landing-btn-ghost landing-btn-ghost-lg">
              {l.heroCtaSecondary}
            </a>
          </div>
        </div>
      </section>

      {/* Demo / Mock Browser */}
      <section className="landing-mock-section">
        <div className="landing-mock-inner">
          <p className="landing-mock-label">{l.demoLabel}</p>

          <div ref={mockRef} className={`landing-browser${mockVisible ? ' is-visible' : ''}`}>
            {/* Browser chrome */}
            <div className="landing-browser-bar">
              <div className="landing-browser-dots">
                <div className="landing-browser-dot landing-browser-dot-close" />
                <div className="landing-browser-dot landing-browser-dot-min" />
                <div className="landing-browser-dot landing-browser-dot-max" />
              </div>
              <div className="landing-browser-url">rdd-financetracker.com/dashboard</div>
            </div>

            {/* Mock Dashboard */}
            <div className="landing-mock-layout">

              {/* Sidebar */}
              <div className="landing-mock-sidebar">
                <div className="landing-mock-wordmark">Finance Tracker</div>
                <div className="landing-mock-nav">
                  {(['📊', '💸', '🏷️', '🎯', '🔄', '📅'] as const).map((icon, i) => (
                    <div key={i} className={`landing-mock-nav-item${i === 0 ? ' is-active' : ''}`}>
                      <span>{icon}</span>
                      {l.mockNav[i]}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main */}
              <div className="landing-mock-main">
                <div className="landing-mock-header">
                  <div className="landing-mock-title">Dashboard</div>
                  <div className="landing-mock-period">{l.mockPeriod}</div>
                </div>

                {/* KPI cards */}
                <div className="landing-mock-stats">
                  {[
                    { label: l.mockIncome,  value: '€3.240', icon: '📈' },
                    { label: l.mockExpense, value: '€1.890', icon: '📉' },
                    { label: l.mockBalance, value: '€1.350', icon: '💳' },
                    { label: l.mockTx,      value: '42',     icon: '📋' },
                  ].map((s, i) => (
                    <div key={s.label} className="landing-mock-stat">
                      <div>
                        <div className="landing-mock-stat-label">{s.label}</div>
                        <div className="landing-mock-stat-value" style={{ color: MOCK_STAT_COLORS[i] }}>
                          {s.value}
                        </div>
                      </div>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="landing-mock-charts">
                  {/* Bar chart */}
                  <div className="landing-mock-chart">
                    <div className="landing-mock-chart-label">{l.mockTrend}</div>
                    <div className="landing-mock-bars">
                      {l.mockMonths.map((month, i) => (
                        <div key={month} className="landing-mock-bar-group">
                          <div className="landing-mock-bar-pair">
                            <div
                              className="landing-mock-bar landing-mock-bar-income is-animated"
                              style={{ height: barHeights[i * 2], animationDelay: `${i * 0.05}s` }}
                            />
                            <div
                              className="landing-mock-bar landing-mock-bar-expense is-animated"
                              style={{ height: barHeights[i * 2 + 1], animationDelay: `${i * 0.05 + 0.02}s` }}
                            />
                          </div>
                          <div className="landing-mock-bar-label">{month}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Donut chart */}
                  <div className="landing-mock-chart">
                    <div className="landing-mock-chart-label">{l.mockCategory}</div>
                    <div className="landing-mock-donut-area">
                      <svg width="80" height="80" viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#e2e8f0" strokeWidth="5" />
                        {MOCK_DONUT_COLORS.map((color, i) => (
                          <circle
                            key={color}
                            cx="21" cy="21" r="15.9"
                            fill="transparent"
                            stroke={color}
                            strokeWidth="5"
                            strokeDasharray={DONUT_ARRAYS[i]}
                            strokeDashoffset={DONUT_OFFSETS[i]}
                          />
                        ))}
                      </svg>
                      <div className="landing-mock-legend">
                        {MOCK_DONUT_COLORS.map((color, i) => (
                          <div key={color} className="landing-mock-legend-item">
                            <div className="landing-mock-legend-dot" style={{ background: color }} />
                            {l.mockLegend[i]} {DONUT_PCTS[i]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent transactions */}
                <div className="landing-mock-tx-list">
                  <div className="landing-mock-tx-header">{l.mockRecent}</div>
                  {l.mockTxItems.map((tx, i) => (
                    <div key={tx.name} className={`landing-mock-tx-item landing-tx-${i + 1}`}>
                      <div className="landing-mock-tx-icon" style={{ background: tx.bg }}>{tx.icon}</div>
                      <div className="landing-mock-tx-info">
                        <div className="landing-mock-tx-name">{tx.name}</div>
                        <div className="landing-mock-tx-date">{tx.date}</div>
                      </div>
                      <div
                        className="landing-mock-tx-amount"
                        style={{ color: tx.pos ? '#10b981' : '#ef4444' }}
                      >
                        {tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="landing-features-section">
        <div className="landing-features-inner">
          <div className="landing-features-header">
            <span className="landing-features-eyebrow">{l.featuresEyebrow}</span>
            <h2 className="landing-features-title">
              {l.featuresTitle1}<br />{l.featuresTitle2}
            </h2>
            <p className="landing-features-sub">{l.featuresSub}</p>
          </div>

          <div className="landing-features-grid">
            {l.features.map((f, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <div
                  key={f.title}
                  ref={el => { featureRefs.current[i] = el; }}
                  className={`landing-feature-item${visibleFeatures[i] ? ' is-visible' : ''}`}
                >
                  <div className="landing-feature-icon-box">
                    <Icon size={18} />
                  </div>
                  <div className="landing-feature-content">
                    <h3 className="landing-feature-title">{f.title}</h3>
                    <p className="landing-feature-desc">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="landing-cta-section">
        <div className="landing-cta-inner">
          <h2 className="landing-cta-title">
            {l.ctaBannerTitle1}<br />{l.ctaBannerTitle2}
          </h2>
          <p className="landing-cta-sub">{l.ctaBannerSub}</p>
          <Link to="/register" className="landing-btn-primary landing-btn-primary-lg">
            {l.ctaBannerBtn}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div>
            <span className="landing-footer-brand">Finance Tracker</span>
            <p className="landing-footer-desc">{l.footerDesc}</p>
          </div>
          <div>
            <span className="landing-footer-col-label">{l.footerApp}</span>
            <div className="landing-footer-links">
              <Link to="/login"      className="landing-footer-link">{l.footerSignIn}</Link>
              <Link to="/register"   className="landing-footer-link">{l.footerRegister}</Link>
              <a    href="#features" className="landing-footer-link">{l.footerFeatures}</a>
            </div>
          </div>
          <div>
            <span className="landing-footer-col-label">{l.footerLegal}</span>
            <div className="landing-footer-links">
              <Link to="/privacy" className="landing-footer-link">Privacy Policy</Link>
            </div>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>© 2026 Finance Tracker. All rights reserved.</span>
          <div className="landing-footer-made">
            <span>🇮🇹</span><span>Made in Italy</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
