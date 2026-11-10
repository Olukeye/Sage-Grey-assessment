import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'holocron:search-history';
const MAX_ENTRIES = 8;

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<string[]>(STORAGE_KEY, []);

  const add = useCallback(
    (query: string) => {
      const term = query.trim();
      if (!term) return;
      setHistory((current) =>
        [term, ...current.filter((item) => item.toLowerCase() !== term.toLowerCase())].slice(0, MAX_ENTRIES),
      );
    },
    [setHistory],
  );

  const clear = useCallback(() => setHistory([]), [setHistory]);

  return { history, add, clear };
}
