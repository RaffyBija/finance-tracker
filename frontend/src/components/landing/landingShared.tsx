// Hook, utility e helper condivisi della landing "Il saldo che respira".
import { useState, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type { Lang } from './landingCopy';

// Preferenza reduced-motion (valutata una volta; il sistema raramente la cambia a runtime).
export const REDUCED =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// Saldo proiettato protagonista (hero + valore finale del grafico outlook).
export const PROJECTED = 13842.50;

// ─── formattazione euro (separatori IT/EN) ───
export interface EurParts {
  neg: boolean;
  int: string;
  dec: string;
  dsep: string;
}

export function fmtParts(value: number, lang: Lang): EurParts {
  const neg = value < 0;
  const v = Math.abs(value);
  const fixed = v.toFixed(2);
  const [intRaw, dec] = fixed.split('.');
  const tsep = lang === 'it' ? '.' : ',';
  const dsep = lang === 'it' ? ',' : '.';
  const int = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, tsep);
  return { neg, int, dec, dsep };
}

export function fmtEur(value: number, lang: Lang): string {
  const p = fmtParts(value, lang);
  return (p.neg ? '−' : '') + '€' + p.int + p.dsep + p.dec;
}

// ─── count-up animato (easeOutQuart) ───
export function useCountUp(target: number, run: boolean, duration: number): number {
  const [val, setVal] = useState(REDUCED ? target : 0);
  useEffect(() => {
    if (!run) return;
    if (REDUCED) { setVal(target); return; }
    let raf = 0;
    let start: number | null = null;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const step = (ts: number) => {
      if (start === null) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      setVal(target * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else setVal(target);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return val;
}

// ─── intersezione "una volta" ───
export function useInView(
  options?: IntersectionObserverInit,
): [RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED) { setSeen(true); return; }
    const io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting) { setSeen(true); io.disconnect(); }
      });
    }, { threshold: 0.25, ...(options ?? {}) });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

// ─── progresso scroll 0→1 di una track (per scrollytelling pinnato) ───
// 0 quando il top della track tocca il top del viewport, 1 quando il fondo
// risale fino a lasciare lo stage sticky. Disattivo con reduced-motion.
export function useScrollProgress(ref: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || REDUCED) { setProgress(0); return; }
    let raf = 0;
    const compute = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const p = total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
      setProgress(p);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(compute); };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
  return progress;
}

// ─── true se la viewport abilita il pin (desktop, no reduced-motion) ───
export function usePinEnabled(minWidth = 861): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (REDUCED) { setEnabled(false); return; }
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [minWidth]);
  return enabled;
}

// ─── reveal: sale in posizione quando entra nel viewport ───
interface RiseProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function Rise({ children, delay = 0, className = '' }: RiseProps) {
  const [ref, seen] = useInView();
  return (
    <div
      ref={ref}
      className={'rise' + (seen ? ' in' : '') + (className ? ' ' + className : '')}
      style={{ '--lp-delay': `${seen ? delay : 0}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}
