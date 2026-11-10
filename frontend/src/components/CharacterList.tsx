import { Link } from 'react-router-dom';
import { FavouriteButton } from './FavouriteButton';
import { getIdFromUrl } from '../utils/format';
import type { Character } from '../types';

export function CharacterList({ characters }: { characters: Character[] }) {
  return (
    <ul className="character-list">
      {characters.map((character) => {
        const id = getIdFromUrl(character.url);
        return (
          <li key={id} className="character-list__item">
            <Link to={`/characters/${id}`} className="character-list__link">
              <span className="character-list__name">{character.name}</span>
              <span className="character-list__meta">
                Born {character.birth_year} · {character.gender}
              </span>
            </Link>
            <FavouriteButton character={{ id, name: character.name }} size={18} />
          </li>
        );
      })}
    </ul>
  );
}
