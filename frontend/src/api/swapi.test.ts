import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getCharacterDetails, getCharacters, searchCharacters } from './swapi';
import { luke } from '../test/fixtures';

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('swapi api', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('requests the requested page of characters', async () => {
    fetchMock.mockReturnValue(json({ count: 1, results: [luke] }));
    await getCharacters(3);
    expect(fetchMock.mock.calls[0][0]).toBe('https://swapi.dev/api/people/?page=3');
  });

  it('url-encodes search terms', async () => {
    fetchMock.mockReturnValue(json({ count: 0, results: [] }));
    await searchCharacters('darth vader & co', 1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://swapi.dev/api/people/?search=darth%20vader%20%26%20co&page=1');
  });

  it('throws a friendly ApiError on failure', async () => {
    fetchMock.mockReturnValue(json({}, 500));
    await expect(getCharacters(1)).rejects.toBeInstanceOf(ApiError);
  });

  it('resolves related resources and orders films by episode', async () => {
    const person = {
      ...luke,
      films: ['https://swapi.dev/api/films/3/', 'https://swapi.dev/api/films/1/'],
      vehicles: ['https://swapi.dev/api/vehicles/14/'],
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/people/1/')) return json(person);
      if (url.endsWith('/planets/1/')) return json({ name: 'Tatooine' });
      if (url.endsWith('/films/3/')) return json({ title: 'Return of the Jedi', episode_id: 6, release_date: '1983-05-25', url });
      if (url.endsWith('/films/1/')) return json({ title: 'A New Hope', episode_id: 4, release_date: '1977-05-25', url });
      if (url.endsWith('/vehicles/14/')) return json({ name: 'Snowspeeder' });
      return json({}, 404);
    });

    const details = await getCharacterDetails('1');

    expect(details.id).toBe('1');
    expect(details.homeworld).toBe('Tatooine');
    expect(details.films.map((f) => f.title)).toEqual(['A New Hope', 'Return of the Jedi']);
    expect(details.vehicles).toEqual(['Snowspeeder']);
  });
});
