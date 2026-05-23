'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, BookOpen, Brain, CheckSquare, MessageCircle } from 'lucide-react';
import { listEntries, type DiaryEntry } from '@/lib/storage/diary-store';
import { searchItems, type KnowledgeItem } from '@/lib/storage/knowledge-store';
import { listAllTodos, type Todo } from '@/lib/storage/todo-store';
import { listMessages, type MirrorMessage } from '@/lib/storage/mirror-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiaryResult {
  id: number;
  preview: string;
  date: string;
  moodTags: string[];
}

interface KnowledgeResult {
  id: number;
  title: string;
  category: string;
}

interface TodoResult {
  id: number;
  title: string;
  date: string;
  isCompleted: boolean;
}

interface MirrorResult {
  id: number;
  preview: string;
  role: 'user' | 'assistant';
  date: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KeywordDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const word = decodeURIComponent(params.word as string);
  // 当前页面路径，作为 from 参数传给子页面，使其返回时能回到这里
  const fromPath = encodeURIComponent(pathname);

  const [loading, setLoading] = useState(true);
  const [diaries, setDiaries] = useState<DiaryResult[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeResult[]>([]);
  const [todos, setTodos] = useState<TodoResult[]>([]);
  const [insights, setInsights] = useState<MirrorResult[]>([]);

  useEffect(() => {
    let isMounted = true;
    const lowerWord = word.toLowerCase();

    async function search() {
      try {
        // 并行搜索四个数据源
        const [allDiaries, allKnowledge, allTodos, allMessages] = await Promise.all([
          listEntries().catch(() => [] as DiaryEntry[]),
          searchItems(word).catch(() => [] as KnowledgeItem[]),
          listAllTodos().catch(() => [] as Todo[]),
          listMessages().catch(() => [] as MirrorMessage[]),
        ]);

        if (!isMounted) return;

        // 日记：匹配 content 或 keyThemes
        setDiaries(
          (allDiaries as DiaryEntry[])
            .filter((d) => {
              const contentMatch = d.content?.toLowerCase().includes(lowerWord);
              const themeMatch = d.keyThemes?.some((t) => t.toLowerCase().includes(lowerWord));
              return contentMatch || themeMatch;
            })
            .map((d) => ({
              id: d.id!,
              preview: d.content.slice(0, 80) + (d.content.length > 80 ? '…' : ''),
              date: d.createdAt.slice(0, 10),
              moodTags: d.moodTags || [],
            }))
        );

        // 知识：searchItems 已按 title/rawContent 搜索
        setKnowledge(
          (allKnowledge as KnowledgeItem[]).map((k) => ({
            id: k.id!,
            title: k.title,
            category: k.primaryCategory || '未分类',
          }))
        );

        // 待办：匹配 title
        setTodos(
          (allTodos as Todo[])
            .filter((t) => t.title.toLowerCase().includes(lowerWord))
            .map((t) => ({
              id: t.id!,
              title: t.title,
              date: t.date,
              isCompleted: t.isCompleted,
            }))
        );

        // 洞见：匹配 content
        setInsights(
          (allMessages as MirrorMessage[])
            .filter((m) => m.content?.toLowerCase().includes(lowerWord))
            .map((m) => ({
              id: m.id!,
              preview: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
              role: m.role,
              date: m.createdAt.slice(0, 10),
            }))
        );
      } catch (err) {
        console.error('Keyword search failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    search();
    return () => { isMounted = false; };
  }, [word]);

  const totalResults = diaries.length + knowledge.length + todos.length + insights.length;

  return (
    <div className="fixed inset-0 overflow-y-auto flex flex-col" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 25%, #e3f2fd 50%, #fafaf8 75%, #fff8e1 100%)' }}>
      <div className="flex-1 px-6 pt-14 pb-12 max-w-[800px] w-full mx-auto">
        {/* 顶部返回栏 + 关键词标题 */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 rounded-full bg-white/60 backdrop-blur-sm border border-black/5 flex items-center justify-center hover:bg-white/80 transition-all"
            >
              <ChevronLeft size={16} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-light tracking-widest text-stone-500">「{word}」</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                共找到 {totalResults} 条相关记录
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm italic text-gray-400">正在搜索…</p>
          ) : (
            <div className="space-y-6">
              {/* 日记模块 */}
              <ResultSection
                icon={<BookOpen size={16} />}
                title="日记"
                count={diaries.length}
                color="#b39ddb"
              >
                {diaries.map((d) => (
                  <motion.div
                    key={d.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/diary?id=${d.id}&from=${fromPath}`)}
                    className="p-3 rounded-xl bg-white/50 border border-black/5 cursor-pointer hover:bg-white/70 transition-all"
                  >
                    <p className="text-sm text-gray-600 leading-relaxed">{d.preview}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-300">{d.date}</span>
                      {d.moodTags.map((tag) => (
                        <span key={tag} className="text-xs text-purple-300">#{tag}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </ResultSection>

              {/* 思维藤蔓模块 */}
              <ResultSection
                icon={<Brain size={16} />}
                title="思维藤蔓"
                count={knowledge.length}
                color="#80cbc4"
              >
                {knowledge.map((k) => (
                  <motion.div
                    key={k.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/knowledge?id=${k.id}&from=${fromPath}`)}
                    className="p-3 rounded-xl bg-white/50 border border-black/5 cursor-pointer hover:bg-white/70 transition-all"
                  >
                    <p className="text-sm text-gray-700">{k.title}</p>
                    <span className="text-xs text-gray-300">{k.category}</span>
                  </motion.div>
                ))}
              </ResultSection>

              {/* 待办模块 */}
              <ResultSection
                icon={<CheckSquare size={16} />}
                title="待办"
                count={todos.length}
                color="#ffcc80"
              >
                {todos.map((t) => (
                  <motion.div
                    key={t.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/todos?date=${t.date}&from=${fromPath}`)}
                    className="p-3 rounded-xl bg-white/50 border border-black/5 cursor-pointer hover:bg-white/70 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${t.isCompleted ? 'bg-green-400' : 'bg-orange-300'}`} />
                      <p className={`text-sm ${t.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.title}</p>
                    </div>
                    <span className="text-xs text-gray-300 ml-4">{t.date}</span>
                  </motion.div>
                ))}
              </ResultSection>

              {/* 洞见模块 */}
              <ResultSection
                icon={<MessageCircle size={16} />}
                title="洞见"
                count={insights.length}
                color="#a78bfa"
              >
                {insights.map((m) => (
                  <motion.div
                    key={m.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => router.push(`/mirror?from=${fromPath}`)}
                    className="p-3 rounded-xl bg-white/50 border border-black/5 cursor-pointer hover:bg-white/70 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs ${m.role === 'user' ? 'text-blue-300' : 'text-purple-300'}`}>
                        {m.role === 'user' ? '你' : '洞见'}
                      </span>
                      <span className="text-xs text-gray-300">{m.date}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{m.preview}</p>
                  </motion.div>
                ))}
              </ResultSection>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────────────

function ResultSection({
  icon,
  title,
  count,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 w-full text-left"
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <span className="text-xs text-gray-300">{count} 条</span>
        <span className="ml-auto text-gray-300 text-xs">{expanded ? '收起' : '展开'}</span>
      </button>
      {expanded && <div className="space-y-2 ml-1">{children}</div>}
    </div>
  );
}
