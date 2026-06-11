// Chiusura: invito finale + CTA email.
import { Rise } from './landingShared';
import EmailCTA from './EmailCTA';
import type { LandingCopy } from './landingCopy';

interface LandingClosingProps {
  t: LandingCopy;
}

export default function LandingClosing({ t }: LandingClosingProps) {
  return (
    <section className="close" id="inizia">
      <div className="wrap">
        <Rise><h2 className="close-line" dangerouslySetInnerHTML={{ __html: t.closeLine }} /></Rise>
        <Rise delay={90}><p className="close-sub">{t.closeSub}</p></Rise>
        <Rise delay={160}>
          <div className="close-cta"><EmailCTA t={t} /></div>
        </Rise>
        <Rise delay={220}><p className="cta-sub">{t.ctaSub}</p></Rise>
      </div>
    </section>
  );
}
