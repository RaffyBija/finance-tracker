// Frammento B: ricorrenti/pianificate che si sommano verso il saldo di fine mese.
import { useInView, useCountUp, fmtParts, fmtEur } from '../landingShared';
import type { CSSProperties } from 'react';
import type { Lang, LandingCopy } from '../landingCopy';

interface FragLedgerProps {
  t: LandingCopy;
  lang: Lang;
  active?: boolean;
}

const BASE = 12480.50;

export default function FragLedger({ t, lang, active }: FragLedgerProps) {
  const [ref, seen] = useInView();
  const show = active ?? seen;
  const rows = t.ledRows;
  const target = rows.reduce((s, r) => s + r.v, BASE);
  const sum = useCountUp(target, show, 1400);

  return (
    <div className="frag" ref={ref}>
      <span className="frag-tag">{t.fragTagB}</span>
      <div className="ledger">
        {rows.map((r, i) => {
          const p = fmtParts(r.v, lang);
          return (
            <div
              key={r.name}
              className={'led-row' + (show ? ' in' : '')}
              style={{ '--lp-delay': `${show ? 120 + i * 130 : 0}ms` } as CSSProperties}
            >
              <span className="led-when">{r.when}</span>
              <span className="led-name">
                {r.name}
                {r.rec && <span className="led-rec">{t.recur}</span>}
              </span>
              <span className={'led-amt ' + (r.v >= 0 ? 'pos' : 'neg')}>
                {r.v >= 0 ? '+' : '−'}€{p.int}{p.dsep}{p.dec}
              </span>
            </div>
          );
        })}
        <div className="led-sum">
          <span className="lbl">{t.ledSum}</span>
          <span className="val">{fmtEur(sum, lang)}</span>
        </div>
      </div>
    </div>
  );
}
