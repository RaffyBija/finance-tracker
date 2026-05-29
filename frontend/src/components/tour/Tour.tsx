import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTourContext } from '../../contexts/TourContext';
import { TOUR_STEPS } from './tourSteps';

interface Rect { top: number; left: number; width: number; height: number }

const TOOLTIP_W = 280;
const TOOLTIP_H = 180; // approx
const GAP = 14;
const PADDING = 12;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

function calcTooltipPos(rect: Rect, position: string): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number, left: number;

  if (position === 'bottom') {
    top = rect.top + rect.height + GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  } else {
    // top
    top = rect.top - TOOLTIP_H - GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
  }

  return {
    top: clamp(top, PADDING, vh - TOOLTIP_H - PADDING),
    left: clamp(left, PADDING, vw - TOOLTIP_W - PADDING),
  };
}

export default function Tour() {
  const { isActive, currentStep, total, next, prev, skip } = useTourContext();
  const navigate = useNavigate();
  const [spotlight, setSpotlight] = useState<Rect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const rafRef = useRef<number>(0);

  const step = TOUR_STEPS[currentStep];

  const measureTarget = useCallback(() => {
    if (!step?.target) { setSpotlight(null); return; }
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) { setSpotlight(null); return; }

    const r = el.getBoundingClientRect();
    const INSET = 6;
    const rect = {
      top: r.top - INSET,
      left: r.left - INSET,
      width: r.width + INSET * 2,
      height: r.height + INSET * 2,
    };
    setSpotlight(rect);
    setTooltipPos(calcTooltipPos(rect, step.position));
  }, [step]);

  useEffect(() => {
    if (!isActive || !step?.target) return;
    measureTarget();
    const onResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measureTarget);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, currentStep, measureTarget]);

  const handleNext = () => {
    if (step?.cta) {
      navigate(step.cta.href);
      skip();
    } else {
      next();
    }
  };

  if (!isActive) return null;

  const isCenter = step.position === 'center' || !step.target;
  const isFirst = currentStep === 0;
  const isLast = currentStep === total - 1;

  const Dots = () => (
    <div className="tour-tooltip-dots">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`tour-dot${i === currentStep ? ' is-active' : ''}`} />
      ))}
    </div>
  );

  const Actions = ({ compact }: { compact?: boolean }) => (
    <div className="tour-tooltip-actions">
      {!isLast ? (
        <button className="tour-btn-skip" onClick={skip}>Salta tour</button>
      ) : <span />}
      <div className="tour-tooltip-btns">
        {!isFirst && !compact && (
          <button className="tour-btn-prev" onClick={prev}>← Indietro</button>
        )}
        <button className="tour-btn-next" onClick={handleNext}>
          {isLast ? (step.cta?.label ?? 'Fine') : 'Avanti →'}
        </button>
      </div>
    </div>
  );

  if (isCenter) {
    return (
      <div className="tour-center-overlay">
        <div className="tour-center-card">
          <p className="tour-tooltip-step">Passo {currentStep + 1} di {total}</p>
          <p className="tour-tooltip-title">{step.title}</p>
          <p className="tour-tooltip-content">{step.content}</p>
          <Dots />
          <div style={{ height: 16 }} />
          <Actions compact />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="tour-backdrop" onClick={skip} />

      {/* Spotlight */}
      {spotlight && (
        <div
          className="tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="tour-tooltip"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="tour-tooltip-step">Passo {currentStep + 1} di {total}</p>
        <p className="tour-tooltip-title">{step.title}</p>
        <p className="tour-tooltip-content">{step.content}</p>
        <Dots />
        <div style={{ height: 12 }} />
        <Actions />
      </div>
    </>
  );
}
