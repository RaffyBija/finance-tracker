import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'it' | 'en';

const t = {
  it: {
    badge: 'Gratuito · Nessuna carta richiesta',
    heroTitle1: 'Prendi il controllo',
    heroTitle2: 'delle tue',
    heroTitleAccent: 'finanze personali',
    heroSub: "Traccia entrate e uscite, gestisci budget, pianifica spese future e visualizza trend mensili — tutto in un'unica dashboard intuitiva.",
    heroCta: 'Inizia subito — è gratis',
    heroCtaSecondary: 'Scopri le funzionalità',
    stat1Label: "Sezioni dell'app",
    stat2Label: 'Dati tuoi',
    stat3Label: 'Transazioni',
    demoLabel: '// Anteprima dell\'interfaccia',
    featuresEyebrow: 'Funzionalità',
    featuresTitle1: 'Tutto ciò che ti serve,',
    featuresTitle2: 'niente di superfluo',
    featuresSub: 'Progettato per chi vuole chiarezza sulle proprie finanze senza complessità inutili.',
    features: [
      { icon: '📊', title: 'Dashboard in tempo reale', desc: 'Panoramica istantanea di entrate, uscite, saldo e andamento mensile con grafici interattivi.' },
      { icon: '💸', title: 'Gestione transazioni', desc: 'Registra e categorizza ogni movimento economico. Filtra, cerca e analizza la tua spesa.' },
      { icon: '🎯', title: 'Budget personalizzati', desc: 'Imposta budget settimanali, mensili o annuali per categoria e monitora quanto hai speso.' },
      { icon: '🔄', title: 'Transazioni ricorrenti', desc: 'Automatizza abbonamenti, affitti e stipendi. Finance Tracker li include nel calcolo del saldo futuro.' },
      { icon: '📅', title: 'Spese pianificate', desc: 'Inserisci spese future come vacanze o acquisti importanti e visualizza l\'impatto sul tuo saldo.' },
      { icon: '🔮', title: 'Proiezione del saldo', desc: 'Scopri come sarà il tuo saldo nei prossimi mesi includendo ricorrenti e pianificate automaticamente.' },
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
    mockPeriod: 'Marzo 2026',
    mockIncome: 'Entrate',
    mockExpense: 'Uscite',
    mockBalance: 'Saldo',
    mockTx: 'Transazioni',
    mockTrend: 'Trend mensile',
    mockCategory: 'Per categoria',
    mockRecent: 'Transazioni recenti',
    mockMonths: ['Ott','Nov','Dic','Gen','Feb','Mar'],
    mockNav: ['Dashboard','Transazioni','Categorie','Budget','Ricorrenti','Pianificate'],
  },
  en: {
    badge: 'Free · No credit card required',
    heroTitle1: 'Take control of',
    heroTitle2: 'your',
    heroTitleAccent: 'personal finances',
    heroSub: 'Track income and expenses, manage budgets, plan future transactions and visualize monthly trends — all in one intuitive dashboard.',
    heroCta: 'Start for free',
    heroCtaSecondary: 'Explore features',
    stat1Label: 'App sections',
    stat2Label: 'Your data',
    stat3Label: 'Transactions',
    demoLabel: '// Interface preview',
    featuresEyebrow: 'Features',
    featuresTitle1: 'Everything you need,',
    featuresTitle2: "nothing you don't",
    featuresSub: 'Designed for those who want clarity on their finances without unnecessary complexity.',
    features: [
      { icon: '📊', title: 'Real-time Dashboard', desc: 'Instant overview of income, expenses, balance and monthly trends with interactive charts.' },
      { icon: '💸', title: 'Transaction Management', desc: 'Record and categorize every financial transaction. Filter, search and analyze your spending.' },
      { icon: '🎯', title: 'Custom Budgets', desc: "Set weekly, monthly or yearly budgets by category and track how much you've spent." },
      { icon: '🔄', title: 'Recurring Transactions', desc: 'Automate subscriptions, rent and salaries. Finance Tracker includes them in future balance calculations.' },
      { icon: '📅', title: 'Planned Expenses', desc: 'Add future expenses like holidays or big purchases and visualize their impact on your balance.' },
      { icon: '🔮', title: 'Balance Projection', desc: 'See what your balance will look like in the coming months, including recurring and planned transactions.' },
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
    mockPeriod: 'March 2026',
    mockIncome: 'Income',
    mockExpense: 'Expenses',
    mockBalance: 'Balance',
    mockTx: 'Transactions',
    mockTrend: 'Monthly trend',
    mockCategory: 'By category',
    mockRecent: 'Recent transactions',
    mockMonths: ['Oct','Nov','Dec','Jan','Feb','Mar'],
    mockNav: ['Dashboard','Transactions','Categories','Budget','Recurring','Planned'],
  },
};

const barHeights = [55, 40, 70, 50, 60, 45, 80, 55, 65, 48, 90, 60];

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
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setMockVisible(true);
    }, { threshold: 0.1 });
    if (mockRef.current) obs.observe(mockRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const observers = featureRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          setVisibleFeatures(prev => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
        }
      }, { threshold: 0.1 });
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div style={{ fontFamily: "'Sora', sans-serif", overflowX: 'hidden', background: '#fff' }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');

        .landing-feature-card {
          transition: all 0.35s ease;
          cursor: default;
        }
        .landing-feature-card:hover {
          border-color: #bfdbfe !important;
          background: #eff6ff !important;
          box-shadow: 0 12px 40px rgba(37,99,235,0.15) !important;
          transform: translateY(-4px) !important;
        }
        .landing-btn-primary {
          transition: all 0.2s ease;
        }
        .landing-btn-primary:hover {
          background: #1d4ed8 !important;
          box-shadow: 0 4px 20px rgba(37,99,235,0.4) !important;
          transform: translateY(-1px);
        }
        .landing-btn-ghost {
          transition: all 0.2s ease;
        }
        .landing-btn-ghost:hover {
          border-color: #2563eb !important;
          color: #2563eb !important;
          background: #eff6ff !important;
        }
        .landing-footer-link {
          transition: color 0.2s;
          color: rgba(255,255,255,0.6);
          text-decoration: none;
          font-size: 14px;
        }
        .landing-footer-link:hover { color: white; }

        @keyframes landing-fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes landing-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
        @keyframes landing-growBar {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @keyframes landing-fadeIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .landing-anim-1 { opacity:0; animation: landing-fadeUp 0.6s ease 0.1s forwards; }
        .landing-anim-2 { opacity:0; animation: landing-fadeUp 0.7s ease 0.2s forwards; }
        .landing-anim-3 { opacity:0; animation: landing-fadeUp 0.7s ease 0.35s forwards; }
        .landing-anim-4 { opacity:0; animation: landing-fadeUp 0.7s ease 0.5s forwards; }
        .landing-anim-5 { opacity:0; animation: landing-fadeUp 0.7s ease 0.65s forwards; }
        .landing-pulse-dot { animation: landing-pulse 2s ease infinite; }
        .landing-bar { animation: landing-growBar 1s ease forwards; transform-origin: bottom; }
        .landing-tx-1 { opacity:0; animation: landing-fadeIn 0.4s ease 0.1s forwards; }
        .landing-tx-2 { opacity:0; animation: landing-fadeIn 0.4s ease 0.2s forwards; }
        .landing-tx-3 { opacity:0; animation: landing-fadeIn 0.4s ease 0.3s forwards; }

        @media (max-width: 900px) {
          .landing-mock-sidebar { display: none !important; }
          .landing-mock-grid { grid-template-columns: 1fr !important; }
          .landing-stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .landing-charts-row { grid-template-columns: 1fr !important; }
          .landing-features-grid { grid-template-columns: 1fr 1fr !important; }
          .landing-footer-grid { grid-template-columns: 1fr !important; gap: 28px !important; }
          .landing-hero-stats { gap: 24px !important; flex-wrap: wrap; }
          .landing-stat-divider { display: none !important; }
          .landing-nav-ghost { display: none !important; }
        }
        @media (max-width: 600px) {
          .landing-features-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Lang Toggle */}
      <div style={{
        position: 'fixed', top: 20, right: 24, zIndex: 1000,
        display: 'flex', gap: 4,
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)',
        border: '1px solid #e2e8f0', borderRadius: 50, padding: 4,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {(['it','en'] as Lang[]).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: '6px 14px', border: 'none', borderRadius: 50,
            fontFamily: "'Sora', sans-serif", fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.2s',
            background: lang === l ? '#2563eb' : 'transparent',
            color: lang === l ? 'white' : '#475569',
          }}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Navbar */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 900,
        padding: '0 40px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(226,232,240,0.6)',
        boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.07)' : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, fontSize: 18,
            background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>💰</div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
            Finance Tracker
          </span>
        </a>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingRight: 110 }}>
          <Link to="/login" className="landing-btn-ghost" style={{
            display: 'inline-flex', alignItems: 'center', padding: '10px 22px',
            borderRadius: 50, fontSize: 14, fontWeight: 600, textDecoration: 'none',
            border: '1.5px solid #e2e8f0', color: '#334155', background: 'transparent',
          }} >
            {l.navSignIn}
          </Link>
          <Link to="/register" className="landing-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', padding: '10px 22px',
            borderRadius: 50, fontSize: 14, fontWeight: 600, textDecoration: 'none',
            background: '#2563eb', color: 'white',
            boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
          }}>
            {l.navCta}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: '100vh', paddingTop: 120, paddingBottom: 80,
        paddingLeft: 40, paddingRight: 40,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: `
          radial-gradient(ellipse 60% 50% at 50% -10%, rgba(37,99,235,0.09) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 90% 60%, rgba(16,185,129,0.06) 0%, transparent 60%),
          #f8fafc
        `,
      }}>
        {/* Dot background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: '28px 28px', opacity: 0.5, zIndex: 0,
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760 }}>
          {/* Badge */}
          <div className="landing-anim-1" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '6px 16px', background: '#eff6ff',
            border: '1px solid #dbeafe', borderRadius: 50,
            fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 28,
          }}>
            <span className="landing-pulse-dot" style={{
              width: 7, height: 7, background: '#2563eb', borderRadius: '50%', display: 'inline-block',
            }} />
            {l.badge}
          </div>

          {/* Title */}
          <h1 className="landing-anim-2" style={{
            fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 800,
            lineHeight: 1.1, letterSpacing: '-2px', color: '#0f172a', marginBottom: 22,
          }}>
            {l.heroTitle1}<br />{l.heroTitle2}{' '}
            <span style={{
              background: 'linear-gradient(135deg, #2563eb, #10b981)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              {l.heroTitleAccent}
            </span>
          </h1>

          <p className="landing-anim-3" style={{
            fontSize: 18, color: '#475569', maxWidth: 520,
            margin: '0 auto 36px', fontWeight: 400, lineHeight: 1.7,
          }}>
            {l.heroSub}
          </p>

          <div className="landing-anim-4" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" className="landing-btn-primary" style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '15px 34px', borderRadius: 50, fontSize: 16, fontWeight: 600,
              textDecoration: 'none', background: '#2563eb', color: 'white',
              boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
            }}>
              {l.heroCta}
            </Link>
            <a href="#features" className="landing-btn-ghost" style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '15px 34px', borderRadius: 50, fontSize: 16, fontWeight: 600,
              textDecoration: 'none', border: '1.5px solid #e2e8f0', color: '#334155', background: 'transparent',
            }}>
              {l.heroCtaSecondary}
            </a>
          </div>

          {/* Stats */}
          <div className="landing-anim-5 landing-hero-stats" style={{
            display: 'flex', gap: 40, justifyContent: 'center', marginTop: 56,
          }}>
            {[
              { num: '6+', label: l.stat1Label },
              { num: '100%', label: l.stat2Label },
              { num: '∞', label: l.stat3Label },
            ].map((s, i) => (
              <>
                {i > 0 && <div className="landing-stat-divider" key={`d${i}`} style={{ width: 1, background: '#e2e8f0', alignSelf: 'stretch' }} />}
                <div key={s.num} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', letterSpacing: '-1px' }}>{s.num}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
                </div>
              </>
            ))}
          </div>
        </div>
      </section>

      {/* Demo / Mock Browser */}
      <section style={{ padding: '0 40px 100px', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{
            textAlign: 'center', fontFamily: "'DM Mono', monospace",
            fontSize: 13, fontWeight: 600, color: '#94a3b8',
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 32,
          }}>
            {l.demoLabel}
          </p>
          <div ref={mockRef} style={{
            background: 'white', borderRadius: 20, overflow: 'hidden',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 20px 80px rgba(15,23,42,0.12), 0 40px 120px rgba(37,99,235,0.06)',
            opacity: mockVisible ? 1 : 0,
            transform: mockVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}>
            {/* Browser bar */}
            <div style={{
              background: '#f1f5f9', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 12,
              borderBottom: '1px solid #e2e8f0',
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {['#ff5f56','#ffbd2e','#27c93f'].map(c => (
                  <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                ))}
              </div>
              <div style={{
                flex: 1, background: 'white', borderRadius: 6, padding: '5px 12px',
                fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#94a3b8',
                border: '1px solid #e2e8f0',
              }}>
                rdd-financetracker.com/dashboard
              </div>
            </div>

            {/* Mock Dashboard */}
            <div className="landing-mock-grid" style={{
              display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 520, background: '#f8fafc',
            }}>
              {/* Sidebar */}
              <div className="landing-mock-sidebar" style={{ background: '#0f172a', padding: '24px 0' }}>
                <div style={{
                  padding: '0 20px 24px', fontWeight: 700, color: 'white', fontSize: 15,
                  display: 'flex', alignItems: 'center', gap: 8,
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, fontSize: 14,
                    background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>💰</div>
                  Finance Tracker
                </div>
                <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(['📊','💸','🏷️','🎯','🔄','📅'] as const).map((icon, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      fontSize: 13, fontWeight: 500,
                      background: i === 0 ? 'rgba(37,99,235,0.25)' : 'transparent',
                      color: i === 0 ? 'white' : 'rgba(255,255,255,0.45)',
                    }}>
                      <span style={{ fontSize: 16 }}>{icon}</span>
                      {l.mockNav[i]}
                    </div>
                  ))}
                </div>
              </div>

              {/* Main */}
              <div style={{ padding: 24, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Dashboard</div>
                  <div style={{
                    padding: '6px 14px', background: 'white', border: '1px solid #e2e8f0',
                    borderRadius: 8, fontSize: 12, color: '#475569', fontWeight: 500,
                  }}>{l.mockPeriod}</div>
                </div>

                {/* Stat cards */}
                <div className="landing-stats-grid" style={{
                  display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20,
                }}>
                  {[
                    { label: l.mockIncome, value: '€3.240', color: '#10b981', icon: '📈' },
                    { label: l.mockExpense, value: '€1.890', color: '#ef4444', icon: '📉' },
                    { label: l.mockBalance, value: '€1.350', color: '#2563eb', icon: '💳' },
                    { label: l.mockTx, value: '42', color: '#0f172a', icon: '📋' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: 'white', borderRadius: 10, padding: 16, border: '1px solid #f1f5f9',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{s.label}</div>
                          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', color: s.color }}>{s.value}</div>
                        </div>
                        <span style={{ fontSize: 18 }}>{s.icon}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div className="landing-charts-row" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 12 }}>
                  {/* Bar chart */}
                  <div style={{ background: 'white', borderRadius: 10, padding: 16, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 14 }}>{l.mockTrend}</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
                      {l.mockMonths.map((month, i) => (
                        <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                          <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 88 }}>
                            <div className="landing-bar" style={{
                              width: '100%', height: barHeights[i * 2],
                              background: '#10b981', borderRadius: '4px 4px 0 0',
                              animationDelay: `${i * 0.05}s`,
                            }} />
                            <div className="landing-bar" style={{
                              width: '100%', height: barHeights[i * 2 + 1],
                              background: '#ef4444', opacity: 0.7, borderRadius: '4px 4px 0 0',
                              animationDelay: `${i * 0.05 + 0.02}s`,
                            }} />
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{month}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Donut chart */}
                  <div style={{ background: 'white', borderRadius: 10, padding: 16, border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 14 }}>{l.mockCategory}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <svg width="80" height="80" viewBox="0 0 42 42" style={{ flexShrink: 0 }}>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#e2e8f0" strokeWidth="5"/>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#2563eb" strokeWidth="5" strokeDasharray="35 65" strokeDashoffset="25"/>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#10b981" strokeWidth="5" strokeDasharray="25 75" strokeDashoffset="-10"/>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#f59e0b" strokeWidth="5" strokeDasharray="20 80" strokeDashoffset="-35"/>
                        <circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#ef4444" strokeWidth="5" strokeDasharray="15 85" strokeDashoffset="-55"/>
                      </svg>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[['#2563eb','35%'],['#10b981','25%'],['#f59e0b','20%'],['#ef4444','15%']].map(([c,pct],i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: '#475569' }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                            {['Affitto','Stipendio','Spesa','Altro'][i]} {pct}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions */}
                <div style={{ background: 'white', borderRadius: 10, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', fontSize: 12, fontWeight: 600, color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                    {l.mockRecent}
                  </div>
                  {[
                    { icon: '🏠', bg: '#eff6ff', name: 'Affitto', date: `1 ${l.mockPeriod.split(' ')[0]}`, amount: '−€850,00', pos: false, cls: 'landing-tx-1' },
                    { icon: '💼', bg: '#f0fdf4', name: 'Stipendio', date: `28 Feb`, amount: '+€2.400,00', pos: true, cls: 'landing-tx-2' },
                    { icon: '🛒', bg: '#fefce8', name: 'Supermercato', date: `27 Feb`, amount: '−€124,50', pos: false, cls: 'landing-tx-3' },
                  ].map(tx => (
                    <div key={tx.name} className={tx.cls} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px', borderBottom: '1px solid #f8fafc',
                    }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: tx.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{tx.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{tx.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{tx.date}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: tx.pos ? '#10b981' : '#ef4444' }}>{tx.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '100px 40px', background: 'white' }}>
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto 64px' }}>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500,
            letterSpacing: 2, textTransform: 'uppercase' as const, color: '#2563eb',
            marginBottom: 14, display: 'block',
          }}>{l.featuresEyebrow}</span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a', lineHeight: 1.15, marginBottom: 16 }}>
            {l.featuresTitle1}<br />{l.featuresTitle2}
          </h2>
          <p style={{ fontSize: 17, color: '#475569', lineHeight: 1.7 }}>{l.featuresSub}</p>
        </div>
        <div className="landing-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
          {l.features.map((f, i) => (
            <div
              key={f.title}
              ref={el => { featureRefs.current[i] = el; }}
              className="landing-feature-card"
              style={{
                padding: 32, borderRadius: 16, border: '1px solid #f1f5f9',
                background: '#f8fafc',
                opacity: visibleFeatures[i] ? 1 : 0,
                transform: visibleFeatures[i] ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s, border-color 0.35s, background 0.35s, box-shadow 0.35s`,
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 24,
                background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 20,
              }}>{f.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10, letterSpacing: '-0.3px' }}>{f.title}</div>
              <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{
        padding: '80px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at 30% 50%, rgba(37,99,235,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(16,185,129,0.1) 0%, transparent 50%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(26px,4vw,40px)', fontWeight: 800, color: 'white', letterSpacing: '-1.5px', marginBottom: 16 }}>
            {l.ctaBannerTitle1}<br />{l.ctaBannerTitle2}
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginBottom: 32, lineHeight: 1.7 }}>
            {l.ctaBannerSub}
          </p>
          <Link to="/register" className="landing-btn-primary" style={{
            display: 'inline-flex', alignItems: 'center', padding: '15px 34px',
            borderRadius: 50, fontSize: 16, fontWeight: 600, textDecoration: 'none',
            background: '#2563eb', color: 'white', boxShadow: '0 2px 12px rgba(37,99,235,0.3)',
          }}>
            {l.ctaBannerBtn}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0f172a', padding: '60px 40px', color: 'white' }}>
        <div className="landing-footer-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, fontSize: 18,
                background: 'linear-gradient(135deg, #2563eb, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>💰</div>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Finance Tracker</span>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, maxWidth: 260 }}>{l.footerDesc}</p>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)', marginBottom: 16, fontFamily: "'DM Mono', monospace" }}>{l.footerApp}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/login" className="landing-footer-link">{l.footerSignIn}</Link>
              <Link to="/register" className="landing-footer-link">{l.footerRegister}</Link>
              <a href="#features" className="landing-footer-link">{l.footerFeatures}</a>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.4)', marginBottom: 16, fontFamily: "'DM Mono', monospace" }}>{l.footerLegal}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Link to="/privacy" className="landing-footer-link">Privacy Policy</Link>
            </div>
          </div>
        </div>
        <div style={{
          maxWidth: 1100, margin: '40px auto 0', paddingTop: 28,
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, color: 'rgba(255,255,255,0.3)',
        }}>
          <span>© 2026 Finance Tracker. All rights reserved.</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px',
            background: 'rgba(255,255,255,0.05)', borderRadius: 50, fontSize: 12,
          }}>
            <span>🇮🇹</span><span>Made in Italy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
