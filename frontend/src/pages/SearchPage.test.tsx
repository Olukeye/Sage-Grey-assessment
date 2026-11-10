import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchPage } from './SearchPage';
import * as api from '../api/swapi';
import { luke, page } from '../test/fixtures';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/swapi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/swapi')>()),
  searchCharacters: vi.fn(),
}));

const searchCharacters = vi.mocked(api.searchCharacters);

describe('SearchPage', () => {
  beforeEach(() => {
    searchCharacters.mockReset();
  });

  it('searches using the q param and lists matches', async () => {
    searchCharacters.mockResolvedValue(page([luke]));
    renderWithProviders(<SearchPage />, '/search?q=luke');

    expect(await screen.findByRole('link', { name: /luke skywalker/i })).toBeInTheDocument();
    expect(searchCharacters).toHaveBeenCalledWith('luke', 1, expect.any(AbortSignal));
    expect(screen.getByText(/1 character matches/i)).toBeInTheDocument();
  });

  it('explains when nothing matches', async () => {
    searchCharacters.mockResolvedValue(page([]));
    renderWithProviders(<SearchPage />, '/search?q=zzz');

    expect(await screen.findByText(/no characters match “zzz”/i)).toBeInTheDocument();
  });
});
