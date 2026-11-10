import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE } from '../api/swapi';

interface Props {
  page: number;
  totalItems: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalItems, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (totalPages === 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button type="button" className="button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" /> Previous
      </button>
      <span className="pagination__status">
        Page {page} of {totalPages}
      </span>
      <button type="button" className="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
