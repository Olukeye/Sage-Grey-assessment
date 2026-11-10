import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getCharacterDetails } from '../api/swapi';
import { FavouriteButton } from '../components/FavouriteButton';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { formatDate, toRoman, withUnit } from '../utils/format';

function NameList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className="detail-section">
      <h2>{title}</h2>
      <ul className="tag-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function CharacterPage() {
  const { id = '' } = useParams();
  const result = useAsync((signal) => getCharacterDetails(id, signal), [id]);

  return (
    <article>
      <Link to="/" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> All characters
      </Link>

      {result.status === 'loading' && <Loading label="Loading character" />}
      {result.status === 'error' && <ErrorMessage message={result.message} onRetry={result.reload} />}

      {result.status === 'success' && (
        <>
          <header className="character-header">
            <h1 className="character-header__name">{result.data.character.name}</h1>
            <FavouriteButton character={{ id: result.data.id, name: result.data.character.name }} size={28} />
          </header>

          <dl className="attributes">
            {[
              ['Birth year', result.data.character.birth_year],
              ['Gender', result.data.character.gender],
              ['Homeworld', result.data.homeworld ?? 'unknown'],
              ['Height', withUnit(result.data.character.height, 'cm')],
              ['Mass', withUnit(result.data.character.mass, 'kg')],
              ['Hair', result.data.character.hair_color],
              ['Skin', result.data.character.skin_color],
              ['Eyes', result.data.character.eye_color],
            ].map(([label, value]) => (
              <div key={label} className="attributes__row">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <section className="detail-section">
            <h2>Films</h2>
            {result.data.films.length === 0 ? (
              <p className="muted">No film appearances recorded.</p>
            ) : (
              <ol className="film-list">
                {result.data.films.map((film) => (
                  <li key={film.url}>
                    <span className="film-list__episode">Episode {toRoman(film.episode_id)}</span>
                    <span className="film-list__title">{film.title}</span>
                    <span className="film-list__date">{formatDate(film.release_date)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <NameList title="Species" items={result.data.species} />
          <NameList title="Vehicles" items={result.data.vehicles} />
          <NameList title="Starships" items={result.data.starships} />
        </>
      )}
    </article>
  );
}
