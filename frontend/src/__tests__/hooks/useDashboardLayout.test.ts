import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  useDashboardLayout,
  mergeLayout,
  buildInitialLayout,
  defaultLayout,
  STORAGE_KEY,
  type LayoutItem,
} from '../../hooks/useDashboardLayout';
import { WIDGET_REGISTRY } from '../../components/dashboard/widgets/registry';

describe('useDashboardLayout — helper puri', () => {
  beforeEach(() => localStorage.clear());

  it('defaultLayout rispecchia il registry (ordine + defaultEnabled)', () => {
    const dl = defaultLayout();
    expect(dl).toHaveLength(WIDGET_REGISTRY.length);
    expect(dl.map((i) => i.id)).toEqual(WIDGET_REGISTRY.map((w) => w.id));
    expect(dl.map((i) => i.enabled)).toEqual(WIDGET_REGISTRY.map((w) => w.defaultEnabled));
  });

  it('mergeLayout mantiene ordine + enabled degli id salvati validi', () => {
    const stored: LayoutItem[] = [
      { id: 'projection', enabled: false },
      { id: 'quick-actions', enabled: true },
    ];
    const merged = mergeLayout(stored);
    // i due salvati restano in testa nell'ordine salvato
    expect(merged[0]).toEqual({ id: 'projection', enabled: false });
    expect(merged[1]).toEqual({ id: 'quick-actions', enabled: true });
  });

  it('mergeLayout scarta id non più presenti nel registry', () => {
    const stored = [
      { id: 'widget-obsoleto', enabled: true },
      { id: 'projection', enabled: true },
    ] as unknown as LayoutItem[];
    const merged = mergeLayout(stored);
    expect(merged.find((i) => (i.id as string) === 'widget-obsoleto')).toBeUndefined();
    expect(merged.some((i) => i.id === 'projection')).toBe(true);
  });

  it('mergeLayout appende i nuovi id del registry in coda col loro default', () => {
    const stored: LayoutItem[] = [{ id: 'projection', enabled: true }];
    const merged = mergeLayout(stored);
    // tutti gli id del registry sono presenti, senza duplicati
    expect(merged).toHaveLength(WIDGET_REGISTRY.length);
    const ids = merged.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    // un id non salvato (es. cc-tiles) appare con il suo defaultEnabled
    const cc = WIDGET_REGISTRY.find((w) => w.id === 'cc-tiles')!;
    expect(merged.find((i) => i.id === 'cc-tiles')!.enabled).toBe(cc.defaultEnabled);
  });

  it('buildInitialLayout torna al default su JSON invalido o vuoto', () => {
    expect(buildInitialLayout(null)).toEqual(defaultLayout());
    expect(buildInitialLayout('non-json')).toEqual(defaultLayout());
    expect(buildInitialLayout('{"foo":1}')).toEqual(defaultLayout());
  });
});

describe('useDashboardLayout — comportamento hook', () => {
  beforeEach(() => localStorage.clear());

  it('toggle inverte enabled e persiste su localStorage', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const before = result.current.items.find((i) => i.id === 'projection')!.enabled;

    act(() => result.current.toggle('projection'));

    const after = result.current.items.find((i) => i.id === 'projection')!.enabled;
    expect(after).toBe(!before);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as LayoutItem[];
    expect(persisted.find((i) => i.id === 'projection')!.enabled).toBe(after);
  });

  it('move scambia due widget della stessa zona (tile)', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const idxBefore = (id: string) => result.current.items.findIndex((i) => i.id === id);
    const ccBefore = idxBefore('cc-tiles');
    const nextBefore = idxBefore('next-expense');
    expect(nextBefore).toBe(ccBefore + 1);

    act(() => result.current.move('next-expense', 'up'));

    expect(idxBefore('next-expense')).toBe(ccBefore);
    expect(idxBefore('cc-tiles')).toBe(nextBefore);
  });

  it('move non attraversa i confini di zona (no-op cross-slot)', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const before = result.current.items.map((i) => i.id);
    // 'cc-tiles' è la prima tessera: muoverla "su" non deve scambiare con la
    // barra azioni (slot diverso) → nessun cambiamento.
    act(() => result.current.move('cc-tiles', 'up'));
    expect(result.current.items.map((i) => i.id)).toEqual(before);
  });

  it('move oltre i bordi è no-op', () => {
    const { result } = renderHook(() => useDashboardLayout());
    const firstId = result.current.items[0].id;
    act(() => result.current.move(firstId, 'up'));
    expect(result.current.items[0].id).toBe(firstId);
  });

  it('reset ripristina il layout di default', () => {
    const { result } = renderHook(() => useDashboardLayout());
    act(() => {
      result.current.toggle('projection');
      result.current.move(result.current.items[1].id, 'up');
    });
    act(() => result.current.reset());
    expect(result.current.items).toEqual(defaultLayout());
  });
});
