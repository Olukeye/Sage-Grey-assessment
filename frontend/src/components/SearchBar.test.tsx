import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SearchBar } from './SearchBar';
import { renderWithProviders } from '../test/renderWithProviders';

const location = () => screen.getByTestId('location').textContent;

describe('SearchBar', () => {
  it('navigates to the search page automatically as the user types (debounced)', async () => {
    renderWithProviders(<SearchBar />);

    await userEvent.type(screen.getByRole('combobox', { name: /search characters/i }), 'luke');

    // Not yet: the debounce hasn't elapsed.
    expect(location()).toBe('/');
    await waitFor(() => expect(location()).toBe('/search?q=luke'));
  });

  it('returns home when the input is cleared on the search page', async () => {
    renderWithProviders(<SearchBar />, '/search?q=luke');
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue('luke');

    await userEvent.clear(input);
    await waitFor(() => expect(location()).toBe('/'));
  });

  it('persists searches and offers them as autocomplete suggestions', async () => {
    window.localStorage.setItem('holocron:search-history', JSON.stringify(['leia', 'luke']));
    renderWithProviders(<SearchBar />);

    await userEvent.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'leia',
      'luke',
      'Clear search history',
    ]);

    await userEvent.click(screen.getByRole('option', { name: 'leia' }));
    await waitFor(() => expect(location()).toBe('/search?q=leia'));
    expect(screen.getByRole('combobox')).toHaveValue('leia');
  });

  it('filters suggestions by what has been typed', async () => {
    window.localStorage.setItem('holocron:search-history', JSON.stringify(['leia', 'luke']));
    renderWithProviders(<SearchBar />);

    await userEvent.type(screen.getByRole('combobox'), 'lu');
    expect(screen.getByRole('option', { name: 'luke' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'leia' })).not.toBeInTheDocument();
  });
});
