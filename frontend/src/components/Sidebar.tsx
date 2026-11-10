import { Link, NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useFavourites } from '../context/FavouritesContext';

interface Props {
  open: boolean;
  onNavigate: () => void;
}

export function Sidebar({ open, onNavigate }: Props) {
  const { favourites, remove } = useFavourites();

  return (
    <aside id="sidebar" className={`sidebar${open ? ' is-open' : ''}`} aria-label="Favourites">
      <h2 className="sidebar__title">Favourites</h2>
      {favourites.length === 0 ? (
        <p className="sidebar__empty">
          Star a character to keep them here.{' '}
          <Link to="/" onClick={onNavigate}>
            Browse characters
          </Link>
        </p>
      ) : (
        <ul className="sidebar__list">
          {favourites.map((favourite) => (
            <li key={favourite.id} className="sidebar__item">
              <NavLink to={`/characters/${favourite.id}`} className="sidebar__link" onClick={onNavigate}>
                {favourite.name}
              </NavLink>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${favourite.name} from favourites`}
                onClick={() => remove(favourite.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
