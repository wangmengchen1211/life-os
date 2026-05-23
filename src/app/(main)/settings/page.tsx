'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ThemeSettings } from '@/components/settings/theme-settings';
import { AiBudgetSettings } from '@/components/settings/ai-budget-settings';
import ExternalImportSettings from '@/components/settings/external-import-settings';
import { DataManagement } from '@/components/settings/data-management';
import { TagManagement } from '@/components/settings/tag-management';
import { SystemInfo } from '@/components/settings/system-info';

export default function SettingsPage() {
  const router = useRouter();
  return (
    <div className="max-w-2xl mx-auto space-y-12 px-6 pt-16 pb-8">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm rounded-lg px-2 py-1 text-gray-500 hover:bg-white/60 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <h1 className="text-2xl font-light tracking-wider text-gray-700">偏好设置</h1>
      </div>

      <ThemeSettings />
      <AiBudgetSettings />
      <div className="border-t border-gray-100/60" />
      <TagManagement />
      <div className="border-t border-gray-100/60" />
      <ExternalImportSettings />
      <DataManagement />
      <div className="border-t border-gray-100/60" />
      <SystemInfo />
    </div>
  );
}
