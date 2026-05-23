'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { ModuleKnowledge } from '@/components/dashboard/module-knowledge';

function KnowledgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const initialItemId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
  const handleBack = () => {
    if (from) {
      router.push(decodeURIComponent(from));
    } else {
      router.push('/');
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto flex flex-col">
      {/* 顶部返回栏 */}
      <div className="flex items-center gap-2 px-4 pt-14 pb-2 flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          onClick={handleBack}
          className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-black/5 flex items-center justify-center hover:bg-white/80 transition-all"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </motion.button>
        <h1 className="text-base font-medium text-gray-700">思维藤蔓</h1>
      </div>

      {/* 模块内容 */}
      <div className="flex-1 min-h-0 px-3 pb-4">
        <ModuleKnowledge initialItemId={initialItemId} />
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <Suspense>
      <KnowledgeContent />
    </Suspense>
  );
}
