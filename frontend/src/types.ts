export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Character {
  name: string;
  height: string;
  mass: string;
  hair_color: string;
  skin_color: string;
  eye_color: string;
  birth_year: string;
  gender: string;
  homeworld: string | null;
  films: string[];
  species: string[];
  vehicles: string[];
  starships: string[];
  url: string;
}

export interface Film {
  title: string;
  episode_id: number;
  release_date: string;
  url: string;
}

export interface CharacterDetails {
  id: string;
  character: Character;
  homeworld: string | null;
  films: Film[];
  species: string[];
  vehicles: string[];
  starships: string[];
}

export interface Favourite {
  id: string;
  name: string;
}
