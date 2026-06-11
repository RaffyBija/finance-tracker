// Sezione "Momenti": scrollytelling pinnato su desktop (track alta + stage sticky,
// i 3 frammenti si animano in sequenza guidati dallo scroll). Fallback impilato su
// mobile (≤860px) e con prefers-reduced-motion.
import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { Rise, usePinEnabled, useScrollProgress, clamp } from './landingShared';
import FragTx from './fragments/FragTx';
import FragLedger from './fragments/FragLedger';
import FragChart from './fragments/FragChart';
import type { Lang, LandingCopy } from './landingCopy';

interface LandingMomentsProps {
  t: LandingCopy;
  lang: Lang;
}

const STEPS = 3;

export default function LandingMoments({ t, lang }: LandingMomentsProps) {
  const pinEnabled = usePinEnabled();
  const trackRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(trackRef, pinEnabled);
  const activeStep = pinEnabled ? clamp(Math.floor(progress * STEPS), 0, STEPS - 1) : -1;

  const frag = (i: number, active?: boolean) =>
    i === 0 ? <FragTx t={t} active={active} />
      : i === 1 ? <FragLedger t={t} lang={lang} active={active} />
        : <FragChart t={t} lang={lang} active={active} />;

  // ── fallback impilato (mobile / reduced-motion) ──
  if (!pinEnabled) {
    return (
      <section className="sec" id="come">
        <div className="wrap">
          <Rise><div className="kicker">{t.s2kicker}</div></Rise>
          <Rise delay={80}>
            <h2 className="sec-title" dangerouslySetInnerHTML={{ __html: t.s2title }} />
          </Rise>
          <div className="moments">
            {t.moments.map((m, i) => (
              <div className={'moment' + (i % 2 ? ' flip' : '')} key={m.idx}>
                <Rise className="m-copy">
                  <div className="m-idx">{m.idx}</div>
                  <h3 className="m-title">{m.title}</h3>
                  <p className="m-body" dangerouslySetInnerHTML={{ __html: m.body }} />
                </Rise>
                <Rise delay={120}>{frag(i)}</Rise>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // ── scrollytelling pinnato ──
  return (
    <section className="lp-moments-track" id="come" ref={trackRef}>
      <div
        className="lp-moments-stage"
        data-active={activeStep}
        style={{ '--lp-progress': progress } as CSSProperties}
      >
        <div className="wrap">
          <div className="lp-moments-head">
            <div className="kicker">{t.s2kicker}</div>
            <h2 className="sec-title" dangerouslySetInnerHTML={{ __html: t.s2title }} />
            <div className="lp-step-count mono">0{activeStep + 1} / 0{STEPS}</div>
          </div>
          <div className="lp-moments-deck">
            {t.moments.map((m, i) => {
              const state = i === activeStep ? ' is-active' : i < activeStep ? ' is-past' : '';
              return (
                <div className={'moment lp-slide' + (i % 2 ? ' flip' : '') + state} key={m.idx}>
                  <div className="m-copy">
                    <div className="m-idx">{m.idx}</div>
                    <h3 className="m-title">{m.title}</h3>
                    <p className="m-body" dangerouslySetInnerHTML={{ __html: m.body }} />
                  </div>
                  <div>{frag(i, i === activeStep)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="lp-progress-bar" />
      </div>
    </section>
  );
}
