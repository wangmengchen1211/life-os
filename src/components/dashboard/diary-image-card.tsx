'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon } from 'lucide-react';
import { listEntries, type DiaryEntry } from '@/lib/storage/diary-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiaryImageItem {
  entryId: number;
  imageBase64: string;
  date: string;
  coreNoun: string;
}

// ─── 核心名词提取 ──────────────────────────────────────────────────────────────

// 简单的中文名词提取：从日记内容中提取关键词/名词短语
function extractCoreNoun(content: string, keyThemes: string[]): string {
  // 优先使用 AI 提取的 keyThemes
  if (keyThemes.length > 0) {
    return keyThemes[0];
  }

  // 简单回退：取前 20 字符中最后一个名词性片段
  const text = content.slice(0, 100).trim();
  if (!text) return '日记';

  // 尝试匹配 2-4 字的中文短语
  const match = text.match(/[\u4e00-\u9fff]{2,4}/);
  return match ? match[0] : '日记';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DiaryImageCard() {
  const router = useRouter();
  const [images, setImages] = useState<DiaryImageItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  // 加载日记图片 + 核心名词
  useEffect(() => {
    let isMounted = true;

    async function loadImages() {
      try {
        const entries = await listEntries();
        const result: DiaryImageItem[] = [];

        for (const entry of entries) {
          if (entry.images && entry.images.length > 0) {
            const coreNoun = extractCoreNoun(entry.content, entry.keyThemes || []);
            // 每篇日记只取第一张图片（避免重复太多）
            result.push({
              entryId: entry.id!,
              imageBase64: entry.images[0],
              date: entry.createdAt.slice(0, 10),
              coreNoun,
            });
          }
        }

        if (isMounted) {
          setImages(result.slice(0, 10));
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    }

    loadImages();
    return () => { isMounted = false; };
  }, []);

  // 自动轮播（24秒）
  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % images.length);
    }, 24000);
    return () => clearInterval(timer);
  }, [images.length]);

  const handleClick = useCallback(() => {
    if (images.length === 0) return;
    const img = images[currentIdx];
    router.push(`/diary?id=${img.entryId}&from=${encodeURIComponent('/diary')}`);
  }, [images, currentIdx, router]);

  // 空态 / 加载态
  if (loading) {
    return (
      <div className="w-full h-[112px] rounded-2xl bg-white/30 backdrop-blur-sm border border-black/5 flex items-center justify-center">
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ImageIcon size={14} className="text-gray-300" />
        </motion.div>
      </div>
    );
  }

  if (images.length === 0) {
    return null;
  }

  const current = images[currentIdx];
  const formattedDate = new Date(current.date).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      className="w-full rounded-2xl overflow-hidden flex cursor-pointer hover:brightness-[1.02] transition-all group"
      style={{ height: '112px' }}
      onClick={handleClick}
    >
      {/* 左侧：图片缩略图 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="w-[112px] h-full flex-shrink-0"
        >
          <img
            src={current.imageBase64}
            alt={`日记图片`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>
      </AnimatePresence>

      {/* 右侧：毛玻璃留白区 + 核心名词 + 日期 */}
      <div className="flex-1 min-w-0 bg-white/30 backdrop-blur-sm border border-black/5 border-l-0 rounded-r-2xl flex items-center justify-between px-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-light text-gray-600 truncate">
            {current.coreNoun}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {formattedDate}
          </p>
        </div>

        {/* 轮播指示 */}
        {images.length > 1 && (
          <div className="flex gap-0.5 flex-shrink-0 ml-2">
            {images.slice(0, 5).map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full transition-all duration-300 ${
                  i === currentIdx % 5 ? 'bg-gray-400/60 w-2' : 'bg-gray-200/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
