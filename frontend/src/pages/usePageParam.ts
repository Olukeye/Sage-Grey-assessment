import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Reads/writes the `page` query param so pagination survives reloads and the back button. */
export function usePageParam() {
  const [params, setParams] = useSearchParams();
  const parsed = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const setPage = useCallback(
    (next: number) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next <= 1) updated.delete('page');
          else updated.set('page', String(next));
          return updated;
        },
        { replace: false },
      );
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );

  return [page, setPage] as const;
}
