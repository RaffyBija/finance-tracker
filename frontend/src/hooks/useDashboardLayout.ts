import { useCallback, useEffect, useState } from 'react';
import { WIDGET_REGISTRY, WIDGET_MAP, type WidgetId } from '../components/dashboard/widgets/registry';

export const STORAGE_KEY = 'dashboard:layout:v1';

export interface LayoutItem {
  id: WidgetId;
  enabled: boolean;
}

const VALID_IDS = new Set<string>(WIDGET_REGISTRY.map((w) => w.id));

/** Layout di default derivato dal registry (ordine + defaultEnabled). */
export function defaultLayout(): LayoutItem[] {
  return WIDGET_REGISTRY.map((w) => ({ id: w.id, enabled: w.defaultEnabled }));
}

/**
 * Fonde un layout salvato col registry corrente (fonte di verità dei widget
 * disponibili). Forward-compat:
 *  - mantiene ordine + enabled degli id salvati ancora presenti nel registry;
 *  - scarta id salvati non più nel registry;
 *  - appende in coda i nuovi id del registry col loro defaultEnabled.
 */
export function mergeLayout(stored: LayoutItem[]): LayoutItem[] {
  const seen = new Set<WidgetId>();
  const merged: LayoutItem[] = [];

  for (const item of stored) {
    if (VALID_IDS.has(item.id) && !seen.has(item.id)) {
      merged.push({ id: item.id, enabled: !!item.enabled });
      seen.add(item.id);
    }
  }
  for (const w of WIDGET_REGISTRY) {
    if (!seen.has(w.id)) {
      merged.push({ id: w.id, enabled: w.defaultEnabled });
    }
  }
  return merged;
}

/** Costruisce il layout iniziale a partire dal valore grezzo di localStorage. */
export function buildInitialLayout(raw: string | null): LayoutItem[] {
  if (!raw) return defaultLayout();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultLayout();
    return mergeLayout(parsed as LayoutItem[]);
  } catch {
    return defaultLayout();
  }
}

export function useDashboardLayout() {
  const [items, setItems] = useState<LayoutItem[]>(() =>
    buildInitialLayout(typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null)
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* localStorage non disponibile: il layout resta in memoria per la sessione */
    }
  }, [items]);

  const toggle = useCallback((id: WidgetId) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, enabled: !it.enabled } : it)));
  }, []);

  // Il riordino agisce SOLO all'interno della stessa zona (bar/tile/content):
  // scambia con il vicino più prossimo dello stesso slot, così le frecce non
  // attraversano mai i confini di zona (che il rendering ignora comunque).
  const move = useCallback((id: WidgetId, dir: 'up' | 'down') => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const slot = WIDGET_MAP[id]?.slot;
      let target = -1;
      if (dir === 'up') {
        for (let j = idx - 1; j >= 0; j--) {
          if (WIDGET_MAP[prev[j].id]?.slot === slot) { target = j; break; }
        }
      } else {
        for (let j = idx + 1; j < prev.length; j++) {
          if (WIDGET_MAP[prev[j].id]?.slot === slot) { target = j; break; }
        }
      }
      if (target === -1) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const reset = useCallback(() => setItems(defaultLayout()), []);

  return { items, toggle, move, reset };
}
