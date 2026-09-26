import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDailyGate } from '../../hooks/useDailyGate';

const KEY = 'testDailyGate';

describe('useDailyGate', () => {
  beforeEach(() => localStorage.clear());

  it('parte non saltato', () => {
    const { result } = renderHook(() => useDailyGate(KEY));
    expect(result.current.isDismissed).toBe(false);
  });

  it('dopo dismiss resta saltato anche ai render successivi (niente loop)', () => {
    const { result, rerender } = renderHook(() => useDailyGate(KEY));
    act(() => result.current.dismiss());
    rerender();
    expect(result.current.isDismissed).toBe(true);
  });

  it('un altro montaggio vede il dismiss di oggi tramite localStorage', () => {
    const first = renderHook(() => useDailyGate(KEY));
    act(() => first.result.current.dismiss());
    const second = renderHook(() => useDailyGate(KEY));
    expect(second.result.current.isDismissed).toBe(true);
  });

  it('un dismiss di un giorno precedente non vale oggi', () => {
    localStorage.setItem(KEY, '2000-01-01');
    const { result } = renderHook(() => useDailyGate(KEY));
    expect(result.current.isDismissed).toBe(false);
  });
});
