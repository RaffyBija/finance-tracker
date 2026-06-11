// Hero: il saldo proiettato protagonista (count-up + respiro), aura, note a
// margine e CTA email.
import { useState, useEffect } from 'react';
import { Rise, useCountUp, fmtParts, fmtEur, PROJECTED } from './landingShared';
import EmailCTA from './EmailCTA';
import type { Lang, LandingCopy } from './landingCopy';

interface LandingHeroProps {
  t: LandingCopy;
  lang: Lang;
}

export default function LandingHero({ t, lang }: LandingHeroProps) {
  const [run, setRun] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setRun(true), 420);
    return () => window.clearTimeout(id);
  }, []);

  const v = useCountUp(PROJECTED, run, 2200);
  const p = fmtParts(v, lang);

  return (
    <header className="hero" id="top">
      <div className="wrap">
        <Rise><span className="eyebrow">{t.eyebrow}</span></Rise>
        <Rise delay={90}>
          <h1 className="hero-line" dangerouslySetInnerHTML={{ __html: t.heroLine }} />
        </Rise>

        <div className="figure">
          <div className="aura" aria-hidden="true" />

          <div className="margins" aria-hidden="true">
            <div className="note n1"><span className="rule" />{t.m1a}<br /><span className="num">{t.m1b}</span></div>
            <div className="note n2"><span className="rule" />{t.m2a}<br /><span className="num">{t.m2b}</span></div>
            <div className="note n3"><span className="rule" />{t.m3a}<br /><span className="num">{t.m3b}</span></div>
          </div>

          <p className="balance-cap">{t.balanceCap}</p>
          <div
            className="balance mono"
            role="img"
            aria-label={t.balanceAria + ' ' + fmtEur(PROJECTED, lang)}
          >
            <span className="breathe">
              <span className="euro">€</span>
              <span className="int">{p.int}</span>
              <span className="dec">{p.dsep}{p.dec}</span>
            </span>
          </div>

          <p className="annot">
            <b>{t.annotBold}</b> {t.annotRest} &nbsp;·&nbsp;
            <span className="live"><span className="dot" />{t.live}</span>
          </p>

          <div className="margins-mobile" aria-hidden="true">
            <span className="mm">{t.m1a} <b>{t.m1b}</b></span>
            <span className="mm">{t.m2a} <b>{t.m2b}</b></span>
            <span className="mm">{t.m3a} <b>{t.m3b}</b></span>
          </div>
        </div>

        <div id="entra">
          <EmailCTA t={t} center />
          <p className="cta-sub">{t.ctaSub}</p>
        </div>
      </div>
    </header>
  );
}
