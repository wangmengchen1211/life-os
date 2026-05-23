import { EmptyState } from '@/components/ui/empty-state';
import { Mail } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div>
      <h1 className="text-xl font-medium text-[var(--text-primary)] mb-6">人生信笺</h1>
      <EmptyState
        icon={<Mail size={48} strokeWidth={1} />}
        title="还没有收到人生信"
        description="每月月初，系统会为你撰写一封回顾过去一月的信笺"
      />
    </div>
  );
}
