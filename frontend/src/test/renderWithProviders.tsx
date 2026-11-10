import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { FavouritesProvider } from '../context/FavouritesContext';

export function LocationDisplay() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

export function renderWithProviders(ui: ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FavouritesProvider>
        {ui}
        <LocationDisplay />
      </FavouritesProvider>
    </MemoryRouter>,
  );
}
