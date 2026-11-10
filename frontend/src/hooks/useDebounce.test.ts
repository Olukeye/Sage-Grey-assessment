import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('only emits the latest value after the delay has elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'l' },
    });

    rerender({ value: 'lu' });
    rerender({ value: 'luk' });
    expect(result.current).toBe('l');

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('l');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('luk');
  });
});
