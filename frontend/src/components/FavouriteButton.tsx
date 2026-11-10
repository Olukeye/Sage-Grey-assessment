import { Star } from 'lucide-react';
import { useFavourites } from '../context/FavouritesContext';
import type { Favourite } from '../types';

interface Props {
  character: Favourite;
  size?: number;
}

export function FavouriteButton({ character, size = 20 }: Props) {
  const { isFavourite, toggle } = useFavourites();
  const active = isFavourite(character.id);

  return (
    <button
      type="button"
      className={`icon-button favourite-button${active ? ' is-active' : ''}`}
      aria-pressed={active}
      aria-label={active ? `Remove ${character.name} from favourites` : `Add ${character.name} to favourites`}
      onClick={() => toggle(character)}
    >
      <Star size={size} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}
