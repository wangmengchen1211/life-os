import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>{icon}</div>
      <h2 className="text-lg font-light mb-2" style={{ color: 'var(--text-primary)', opacity: 0.6 }}>{title}</h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>{description}</p>
    </div>
  );
}
