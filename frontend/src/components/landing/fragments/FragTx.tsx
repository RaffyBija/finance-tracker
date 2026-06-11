// Frammento A: una transazione che si auto-categorizza (chip + testo che "pensa").
import { useState, useEffect } from 'react';
import { ShoppingCart } from 'lucide-react';
import { useInView, REDUCED } from '../landingShared';
import type { LandingCopy } from '../landingCopy';

interface FragTxProps {
  t: LandingCopy;
  active?: boolean;
}

export default function FragTx({ t, active }: FragTxProps) {
  const [ref, seen] = useInView();
  const show = active ?? seen;
  const [chip, setChip] = useState(false);

  useEffect(() => {
    if (!show) { setChip(false); return; }
    const id = window.setTimeout(() => setChip(true), REDUCED ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [show]);

  return (
    <div className="frag" ref={ref}>
      <span className="frag-tag">{t.fragTagA}</span>
      <div className="txrow">
        <span className="tx-ic"><ShoppingCart size={20} /></span>
        <div className="tx-main">
          <div className="tx-name">{t.txName}</div>
          <div className="tx-meta">
            {t.txDate}
            <span className={'chip' + (chip ? ' show' : '')}><span className="cdot" />{t.txCat}</span>
          </div>
        </div>
        <span className="tx-amt mono">−€124,50</span>
      </div>
      <div className="typing">
        {chip ? t.txConfirm : t.txThinking}{!chip && <span className="caret" />}
      </div>
    </div>
  );
}
