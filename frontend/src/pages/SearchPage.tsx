import { useSearchParams } from 'react-router-dom';
import { searchCharacters } from '../api/swapi';
import { CharacterList } from '../components/CharacterList';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorMessage, Loading } from '../components/Status';
import { useAsync } from '../hooks/useAsync';
import { usePageParam } from './usePageParam';

export function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [page, setPage] = usePageParam();
  const result = useAsync((signal) => searchCharacters(query, page, signal), [query, page]);

  return (
    <section>
      <h1 className="page-title">Search results</h1>
      {result.status === 'loading' && <Loading label={`Searching for “${query}”`} />}
      {result.status === 'error' && <ErrorMessage message={result.message} onRetry={result.reload} />}
      {result.status === 'success' &&
        (result.data.count === 0 ? (
          <EmptyState title={`No characters match “${query}”`}>Check the spelling or try a shorter name.</EmptyState>
        ) : (
          <>
            <p className="page-subtitle">
              {result.data.count} {result.data.count === 1 ? 'character matches' : 'characters match'} “{query}”
            </p>
            <CharacterList characters={result.data.results} />
            <Pagination page={page} totalItems={result.data.count} onChange={setPage} />
          </>
        ))}
    </section>
  );
}
