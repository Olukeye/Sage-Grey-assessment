import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAsync } from '../useAsync';

describe('useAsync', () => {
  it('resolves to success', async () => {
    const { result } = renderHook(() => useAsync(async () => 'ok', []));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(result.current).toMatchObject({ data: 'ok' });
  });

  it('reports errors', async () => {
    const { result } = renderHook(() =>
      useAsync(async () => {
        throw new Error('boom');
      }, []),
    );
    await waitFor(() => expect(result.current).toMatchObject({ status: 'error', message: 'boom' }));
  });

  it('ignores a slow stale response when deps change', async () => {
    const resolvers: Record<string, (v: string) => void> = {};
    const task = (key: string) => () => new Promise<string>((resolve) => (resolvers[key] = resolve));

    const { result, rerender } = renderHook(({ key }) => useAsync(task(key), [key]), {
      initialProps: { key: 'first' },
    });
    rerender({ key: 'second' });

    resolvers.second('second result');
    await waitFor(() => expect(result.current).toMatchObject({ status: 'success', data: 'second result' }));

    resolvers.first('stale result');
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current).toMatchObject({ data: 'second result' });
  });
});
