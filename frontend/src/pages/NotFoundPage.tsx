import { Link } from 'react-router-dom';
import { EmptyState } from '../components/Status';

export function NotFoundPage() {
  return (
    <EmptyState title="This page doesn’t exist">
      <Link to="/">Go to all characters</Link>
    </EmptyState>
  );
}
