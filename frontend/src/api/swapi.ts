import type { Character, CharacterDetails, Film, Paginated } from '../types';
import { getIdFromUrl } from '../utils/format';

const BASE_URL: string = import.meta.env.VITE_SWAPI_URL ?? 'https://swapi.dev/api';

export const PAGE_SIZE = 10;

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const toHttps = (url: string) => url.replace(/^http:\/\//, 'https://');

async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(toHttps(url), { signal });
  if (!response.ok) {
    throw new ApiError(
      response.status === 404
        ? 'We could not find that record.'
        : 'The Star Wars API is not responding. Please try again.',
      response.status,
    );
  }
  return (await response.json()) as T;
}

// Related resources (films, species, ...) are shared by many characters, so they are
//cached per session. They are fetched without an abort signal so that one cancelled
// consumer cannot poison the cache for another.
const relatedCache = new Map<string, Promise<unknown>>();

function cachedRequest<T>(url: string): Promise<T> {
  let pending = relatedCache.get(url);
  if (!pending) {
    pending = request<T>(url).catch((error: unknown) => {
      relatedCache.delete(url);
      throw error;
    });
    relatedCache.set(url, pending);
  }
  return pending as Promise<T>;
}

const fetchNames = (urls: string[]) =>
  Promise.all(urls.map((url) => cachedRequest<{ name: string }>(url).then((r) => r.name)));

export function getCharacters(page: number, signal?: AbortSignal): Promise<Paginated<Character>> {
  return request(`${BASE_URL}/people/?page=${page}`, signal);
}

export function searchCharacters(
  query: string,
  page: number,
  signal?: AbortSignal,
): Promise<Paginated<Character>> {
  return request(`${BASE_URL}/people/?search=${encodeURIComponent(query)}&page=${page}`, signal);
}

export async function getCharacterDetails(id: string, signal?: AbortSignal): Promise<CharacterDetails> {
  const character = await request<Character>(`${BASE_URL}/people/${id}/`, signal);

  const [homeworld, films, species, vehicles, starships] = await Promise.all([
    character.homeworld
      ? cachedRequest<{ name: string }>(character.homeworld).then((r) => r.name)
      : Promise.resolve(null),
    Promise.all(character.films.map((url) => cachedRequest<Film>(url))),
    fetchNames(character.species),
    fetchNames(character.vehicles),
    fetchNames(character.starships),
  ]);

  return {
    id: getIdFromUrl(character.url),
    character,
    homeworld,
    films: [...films].sort((a, b) => a.episode_id - b.episode_id),
    species,
    vehicles,
    starships,
  };
}
