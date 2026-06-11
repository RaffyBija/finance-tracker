// Frammento C: outlook del saldo — linea piena (passato) + tratteggiata (futuro).
// La geometria SVG è calcolata; le transizioni d'animazione vivono in CSS (classe .in).
import { useInView, fmtEur, PROJECTED } from '../landingShared';
import type { Lang, LandingCopy } from '../landingCopy';

interface FragChartProps {
  t: LandingCopy;
  lang: Lang;
  active?: boolean;
}

const W = 440;
const H = 200;
const PAD_X = 8;
const PAD_TOP = 20;
const PAD_BOT = 26;
const DATA = [12480, 12320, 11980, 12260, 12040, 11760, 13760, 13560, 13400, 13680, 13842.5];
const TODAY_IDX = 6;
const MIN = 11500;
const MAX = 14100;

const xAt = (i: number) => PAD_X + (i / (DATA.length - 1)) * (W - PAD_X * 2);
const yAt = (v: number) => PAD_TOP + (1 - (v - MIN) / (MAX - MIN)) * (H - PAD_TOP - PAD_BOT);
const PTS = DATA.map((v, i) => [xAt(i), yAt(v)] as const);
const lineFrom = (a: number, b: number) =>
  PTS.slice(a, b + 1).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');

const SOLID = lineFrom(0, TODAY_IDX);
const DASHED = lineFrom(TODAY_IDX, DATA.length - 1);
const AREA = SOLID + ` L ${PTS[TODAY_IDX][0].toFixed(1)} ${H - PAD_BOT} L ${PTS[0][0].toFixed(1)} ${H - PAD_BOT} Z`;
const TODAY = PTS[TODAY_IDX];
const END = PTS[PTS.length - 1];

export default function FragChart({ t, lang, active }: FragChartProps) {
  const [ref, seen] = useInView();
  const show = active ?? seen;

  return (
    <div className={'frag lp-chart' + (show ? ' in' : '')} ref={ref}>
      <span className="frag-tag">{t.fragTagC}</span>
      <div className="chart-head">
        <span className="lbl">{t.chartLbl}</span>
        <span className="chart-end">{fmtEur(PROJECTED, lang)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true">
        <defs>
          <linearGradient id="lp-chart-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--teal)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="lp-ch-area" d={AREA} fill="url(#lp-chart-fade)" />
        <line
          x1={TODAY[0]} y1={PAD_TOP - 6} x2={TODAY[0]} y2={H - PAD_BOT}
          stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4"
        />
        <path className="lp-ch-solid" d={SOLID} fill="none" stroke="var(--teal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path className="lp-ch-dashed" d={DASHED} fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="2 6" />
        <circle className="lp-ch-dot-today" cx={TODAY[0]} cy={TODAY[1]} r="4" fill="var(--surface)" stroke="var(--teal)" strokeWidth="2.4" />
        <circle className="lp-ch-dot-end" cx={END[0]} cy={END[1]} r="5.5" fill="var(--teal)" />
      </svg>
      <div className="chart-foot">
        <span>{t.chartToday}</span>
        <span>{t.chartEom}</span>
      </div>
    </div>
  );
}
