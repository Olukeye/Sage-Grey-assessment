import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';
import * as api from '../api/swapi';
import { leia, luke, page } from '../test/fixtures';
import { renderWithProviders } from '../test/renderWithProviders';

vi.mock('../api/swapi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/swapi')>()),
  getCharacters: vi.fn(),
}));

const getCharacters = vi.mocked(api.getCharacters);

describe('HomePage', () => {
  beforeEach(() => {
    getCharacters.mockReset();
  });

  it('renders characters as links to their detail pages', async () => {
    getCharacters.mockResolvedValue(page([luke, leia], 2));
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('link', { name: /luke skywalker/i })).toHaveAttribute('href', '/characters/1');
    expect(screen.getByRole('link', { name: /leia organa/i })).toHaveAttribute('href', '/characters/5');
  });

  it('paginates', async () => {
    getCharacters.mockResolvedValue(page([luke], 25));
    renderWithProviders(<HomePage />);

    await screen.findByText('Page 1 of 3');
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument();
    expect(getCharacters).toHaveBeenLastCalledWith(2, expect.any(AbortSignal));
  });

  it('shows an error with a retry action', async () => {
    getCharacters.mockRejectedValueOnce(new Error('The Star Wars API is not responding.'));
    getCharacters.mockResolvedValueOnce(page([luke]));
    renderWithProviders(<HomePage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('not responding');
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByRole('link', { name: /luke skywalker/i })).toBeInTheDocument();
  });
});
