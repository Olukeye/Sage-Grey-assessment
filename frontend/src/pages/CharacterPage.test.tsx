import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterPage } from './CharacterPage';
import * as api from '../api/swapi';
import { lukeDetails } from '../test/fixtures';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/swapi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/swapi')>()),
  getCharacterDetails: vi.fn(),
}));

const getCharacterDetails = vi.mocked(api.getCharacterDetails);

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/characters/:id" element={<CharacterPage />} />
    </Routes>,
    '/characters/1',
  );

describe('CharacterPage', () => {
  beforeEach(() => {
    getCharacterDetails.mockReset();
  });

  it('shows details including the films the character appears in, in episode order', async () => {
    getCharacterDetails.mockResolvedValue(lukeDetails);
    renderPage();

    expect(await screen.findByRole('heading', { level: 1, name: 'Luke Skywalker' })).toBeInTheDocument();
    expect(screen.getByText('Tatooine')).toBeInTheDocument();
    expect(screen.getByText('172 cm')).toBeInTheDocument();
    const films = screen.getAllByRole('listitem').filter((li) => li.className === '' && /Episode/.test(li.textContent ?? ''));
    expect(films.map((li) => li.textContent)).toEqual([
      expect.stringContaining('A New Hope'),
      expect.stringContaining('Return of the Jedi'),
    ]);
    expect(screen.getByText('X-wing')).toBeInTheDocument();
  });

  it('adds and removes the character from favourites', async () => {
    getCharacterDetails.mockResolvedValue(lukeDetails);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /add luke skywalker to favourites/i }));
    expect(JSON.parse(window.localStorage.getItem('holocron:favourites')!)).toEqual([
      { id: '1', name: 'Luke Skywalker' },
    ]);

    await userEvent.click(screen.getByRole('button', { name: /remove luke skywalker from favourites/i }));
    expect(JSON.parse(window.localStorage.getItem('holocron:favourites')!)).toEqual([]);
  });

  it('shows an error when the character cannot be loaded', async () => {
    getCharacterDetails.mockRejectedValue(new Error('We could not find that record.'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not find');
  });
});
