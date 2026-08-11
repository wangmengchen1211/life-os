'use client';

import ObsidianSettings from './obsidian-settings';

export default function ExternalImportSettings() {
  return (
    <section className="bg-white/60 backdrop-blur-sm border border-black/5 rounded-2xl p-6 space-y-6">
      <div>
        <h2 className="text-sm font-medium text-gray-600 mb-1">外部源导入</h2>
        <p className="text-xs text-gray-500">
          从 Obsidian 把笔记单向导入到 MindOS 知识库。增量去重、自动打标。
        </p>
      </div>
      <ObsidianSettings />
    </section>
  );
}
