import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white/60 backdrop-blur-sm rounded-2xl p-5 border border-gray-100/50 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '' }: CardProps) {
  return (
    <h3 className={`text-sm font-medium text-gray-500 mb-3 ${className}`}>
      {children}
    </h3>
  );
}
