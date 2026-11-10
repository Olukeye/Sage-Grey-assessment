import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { Favourite } from '../types';

const STORAGE_KEY = 'holocron:favourites';

interface FavouritesContextValue {
  favourites: Favourite[];
  isFavourite: (id: string) => boolean;
  toggle: (favourite: Favourite) => void;
  remove: (id: string) => void;
}

const FavouritesContext = createContext<FavouritesContextValue | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const [favourites, setFavourites] = useLocalStorage<Favourite[]>(STORAGE_KEY, []);

  const isFavourite = useCallback((id: string) => favourites.some((f) => f.id === id), [favourites]);

  const remove = useCallback(
    (id: string) => setFavourites((current) => current.filter((f) => f.id !== id)),
    [setFavourites],
  );

  const toggle = useCallback(
    (favourite: Favourite) =>
      setFavourites((current) =>
        current.some((f) => f.id === favourite.id)
          ? current.filter((f) => f.id !== favourite.id)
          : [...current, favourite],
      ),
    [setFavourites],
  );

  const value = useMemo(
    () => ({ favourites, isFavourite, toggle, remove }),
    [favourites, isFavourite, toggle, remove],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavourites(): FavouritesContextValue {
  const context = useContext(FavouritesContext);
  if (!context) throw new Error('useFavourites must be used within a FavouritesProvider');
  return context;
}
