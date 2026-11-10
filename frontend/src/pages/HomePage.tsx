import { getCharacters } from '../api/swapi';
import { CharacterList } from '../components/CharacterList';
import { Pagination } from '../components/Pagination';
import { ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { usePageParam } from './usePageParam';

export function HomePage() {
  const [page, setPage] = usePageParam();
  const result = useAsync((signal) => getCharacters(page, signal), [page]);

  return (
    <section>
      <h1 className="page-title">Characters</h1>
      {result.status === 'loading' && <Loading label="Loading characters" />}
      {result.status === 'error' && <ErrorMessage message={result.message} onRetry={result.reload} />}
      {result.status === 'success' && (
        <>
          <CharacterList characters={result.data.results} />
          <Pagination page={page} totalItems={result.data.count} onChange={setPage} />
        </>
      )}
    </section>
  );
}
