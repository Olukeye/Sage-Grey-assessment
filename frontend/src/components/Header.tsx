import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { SearchBar } from './SearchBar';

export function Header({ sidebarOpen, onToggleSidebar }: { sidebarOpen: boolean; onToggleSidebar: () => void }) {
  return (
    <header className="header">
      <button
        type="button"
        className="icon-button header__menu"
        aria-label="Toggle favourites"
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
        onClick={onToggleSidebar}
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <Link to="/" className="header__brand">
        Holocron
      </Link>
      <SearchBar />
    </header>
  );
}
