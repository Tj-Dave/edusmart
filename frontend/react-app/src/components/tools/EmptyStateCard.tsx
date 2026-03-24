import type { ReactNode } from 'react';

interface EmptyStateCardProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function EmptyStateCard({ title, description, action }: EmptyStateCardProps) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
