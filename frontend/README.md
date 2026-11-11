# Holocron: Star Wars character browser

A React app built on [SWAPI](https://swapi.dev/): browse characters, search as you type, view details and keep favourites.

React 19 · TypeScript · Vite · React Router · SCSS · Vitest + Testing Library

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev        
```

Other scripts:

```bash
npm test          
npm run typecheck
npm run build      
npm run preview   
```

Optional: copy `.env.example` to `.env` to point at a different SWAPI base URL (`VITE_SWAPI_URL`).

## What it does

| Requirement | Where |
|---|---|
| Header search bar that searches **as you type** and shows the results page | `components/SearchBar.tsx` (300 ms debounce, in-flight requests are cancelled so stale responses never overwrite newer ones) |
| *Bonus:* persisted search history as an autocomplete dropdown | Same component + `hooks/useSearchHistory.ts` (last 8, filterable, keyboard accessible, "Clear search history") |
| Sidebar of favourites, persisted, each a link with a remove button | `components/Sidebar.tsx`, `context/FavouritesContext.tsx` (localStorage) |
| Home: paginated list, each character links to details | `pages/HomePage.tsx` (page number lives in the URL, so reload/back/share work) |
| Character details incl. films, with add/remove favourite | `pages/CharacterPage.tsx` (homeworld, films in episode order, species, vehicles, starships) |
| Search results page | `pages/SearchPage.tsx` |

Also: loading, error (with retry) and empty states on every page; responsive layout (the sidebar becomes a slide-in drawer on small screens); keyboard-visible focus; reduced-motion respected.

## Project layout

```
src/
  api/          SWAPI client (+ in-session cache for films/species/etc.)
  components/   Header, SearchBar, Sidebar, CharacterList, Pagination, FavouriteButton, Status
  context/      FavouritesContext
  hooks/        useAsync (cancellable fetch), useDebounce, useLocalStorage, useSearchHistory
  pages/        Home, Character, Search, NotFound
  styles/       SCSS partials: tokens, base, layout, pages
  test/         fixtures and render helpers
```

## Design notes

- **Data fetching**: one small `useAsync` hook handles loading/error/success and aborts the previous request when inputs change, which is what makes fast typing safe.
- **State**: server data is fetched per page; the only global state is favourites (React context + localStorage). Search query and page are kept in the URL.
- **Resilience**: localStorage reads/writes are wrapped, so private mode or corrupt data degrades to in-memory instead of crashing.
- **Tests (22)** cover the API client, hooks, search debounce/navigation/history, sidebar persistence and removal, pagination, and the character page including favouriting.
