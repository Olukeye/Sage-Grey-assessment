import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Clock, Search } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import { useSearchHistory } from '../hooks/useSearchHistory';

export const SEARCH_DEBOUNCE_MS = 300;

export function SearchBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const listId = useId();

  const urlQuery = pathname === '/search' ? (params.get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const { history, add, clear } = useSearchHistory();

  // The last query this component pushed to the URL. It lets us tell "the URL changed because
  // we navigated" (ignore) apart from "the URL changed from elsewhere" (mirror into the input).
  const lastCommitted = useRef(urlQuery);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const debounced = useDebounce(value.trim(), SEARCH_DEBOUNCE_MS);

  const commit = (query: string) => {
    lastCommitted.current = query;
    if (query === '') {
      if (pathnameRef.current === '/search') navigate('/');
      return;
    }
    add(query);
    navigate(`/search?q=${encodeURIComponent(query)}`, { replace: pathnameRef.current === '/search' });
  };

  // Search as the user types.
  useEffect(() => {
    if (debounced !== lastCommitted.current) commit(debounced);
    // `commit` only reads refs and stable callbacks; re-running on its identity would re-fire searches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Mirror URL changes made elsewhere (logo click, back button) into the input.
  useEffect(() => {
    if (urlQuery !== lastCommitted.current) {
      lastCommitted.current = urlQuery;
      setValue(urlQuery);
    }
  }, [urlQuery]);

  const suggestions = useMemo(() => {
    const needle = value.trim().toLowerCase();
    return history.filter((item) => item.toLowerCase().includes(needle) && item.toLowerCase() !== needle);
  }, [history, value]);

  const showSuggestions = open && suggestions.length > 0;

  const select = (query: string) => {
    setValue(query);
    setOpen(false);
    setActiveIndex(-1);
    commit(query);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex]) return select(suggestions[activeIndex]);
    setOpen(false);
    commit(value.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
    } else if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    }
  };

  return (
    <form className="search" role="search" onSubmit={handleSubmit}>
      <Search size={18} className="search__icon" aria-hidden="true" />
      <input
        type="search"
        className="search__input"
        placeholder="Search characters"
        aria-label="Search characters"
        autoComplete="off"
        role="combobox"
        aria-expanded={showSuggestions}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showSuggestions && (
        <ul id={listId} className="search__suggestions" role="listbox" aria-label="Recent searches">
          {suggestions.map((item, index) => (
            <li
              key={item}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`search__suggestion${index === activeIndex ? ' is-active' : ''}`}
              // mousedown (not click) so the selection lands before the input's blur closes the list
              onMouseDown={(event) => {
                event.preventDefault();
                select(item);
              }}
            >
              <Clock size={14} aria-hidden="true" />
              {item}
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            className="search__suggestion search__suggestion--clear"
            onMouseDown={(event) => {
              event.preventDefault();
              clear();
            }}
          >
            Clear search history
          </li>
        </ul>
      )}
    </form>
  );
}
