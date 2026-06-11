// Indice (I–IV): le restanti funzioni come elenco tipografico sobrio.
import { Rise } from './landingShared';
import type { LandingCopy } from './landingCopy';

interface LandingIndexProps {
  t: LandingCopy;
}

export default function LandingIndex({ t }: LandingIndexProps) {
  return (
    <section className="sec" id="indice">
      <div className="wrap">
        <Rise><div className="kicker">{t.s3kicker}</div></Rise>
        <Rise delay={80}>
          <h2 className="sec-title" dangerouslySetInnerHTML={{ __html: t.s3title }} />
        </Rise>
        <div className="index">
          {t.index.map((r, i) => (
            <Rise key={r.num} delay={i * 60}>
              <div className="idx-row">
                <span className="idx-num">{r.num}</span>
                <div className="idx-mid">
                  <div className="idx-name">{r.name}</div>
                  <div className="idx-desc">{r.desc}</div>
                </div>
                <span className="idx-meta">{r.meta}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}
