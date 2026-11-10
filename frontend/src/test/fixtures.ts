import type { Character, CharacterDetails, Paginated } from '../types';

export const luke: Character = {
  name: 'Luke Skywalker',
  height: '172',
  mass: '77',
  hair_color: 'blond',
  skin_color: 'fair',
  eye_color: 'blue',
  birth_year: '19BBY',
  gender: 'male',
  homeworld: 'https://swapi.dev/api/planets/1/',
  films: [],
  species: [],
  vehicles: [],
  starships: [],
  url: 'https://swapi.dev/api/people/1/',
};

export const leia: Character = {
  ...luke,
  name: 'Leia Organa',
  birth_year: '19BBY',
  gender: 'female',
  url: 'https://swapi.dev/api/people/5/',
};

export const page = (results: Character[], count = results.length): Paginated<Character> => ({
  count,
  next: null,
  previous: null,
  results,
});

export const lukeDetails: CharacterDetails = {
  id: '1',
  character: luke,
  homeworld: 'Tatooine',
  films: [
    { title: 'A New Hope', episode_id: 4, release_date: '1977-05-25', url: 'https://swapi.dev/api/films/1/' },
    { title: 'Return of the Jedi', episode_id: 6, release_date: '1983-05-25', url: 'https://swapi.dev/api/films/3/' },
  ],
  species: [],
  vehicles: ['Snowspeeder'],
  starships: ['X-wing'],
};
