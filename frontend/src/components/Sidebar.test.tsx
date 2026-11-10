import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Sidebar } from './Sidebar';
import { renderWithProviders } from '../test/renderWithProviders';

describe('Sidebar', () => {
  it('shows an empty state when there are no favourites', () => {
    renderWithProviders(<Sidebar open onNavigate={() => {}} />);
    expect(screen.getByText(/star a character/i)).toBeInTheDocument();
  });

  it('lists persisted favourites as links and lets the user remove them', async () => {
    window.localStorage.setItem(
      'holocron:favourites',
      JSON.stringify([
        { id: '1', name: 'Luke Skywalker' },
        { id: '5', name: 'Leia Organa' },
      ]),
    );
    renderWithProviders(<Sidebar open onNavigate={() => {}} />);

    expect(screen.getByRole('link', { name: 'Luke Skywalker' })).toHaveAttribute('href', '/characters/1');

    await userEvent.click(screen.getByRole('button', { name: /remove luke skywalker/i }));

    expect(screen.queryByRole('link', { name: 'Luke Skywalker' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leia Organa' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('holocron:favourites')!)).toEqual([
      { id: '5', name: 'Leia Organa' },
    ]);
  });
});
