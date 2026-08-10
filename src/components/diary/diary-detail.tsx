'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit3,
  Trash2,
  MessageCircle,
  RefreshCw,
  Loader2,
  Save,
  X,
  ImagePlus,
} from 'lucide-react';
import {
  getEntry,
  updateEntry,
  deleteEntry,
  type DiaryEntry,
} from '@/lib/storage/diary-store';
import { compressImage } from '@/lib/utils/image-compress';
import { RichText } from '@/components/shared/rich-text';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiaryDetailProps {
  entryId: number;
  onBack?: () => void;
  onDeleted?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJSON(text: string): any {
  try {
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * 流式增量提取 JSON 中 feedback 字段的最长前缀
 * - AI 按 {"feedback": "...", "moodTags": [...], "keyThemes": [...]} 顺序输出
 * - JSON 未闭合时也能提取已输出的部分，实现打字机效果
 */
function extractFeedbackPreview(text: string): string {
  const m = text.match(/"feedback"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return '';
  let v = m[1];
  // 去掉末尾可能未闭合的转义符
  if (v.endsWith('\\')) v = v.slice(0, -1);
  return v
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DiaryDetail({ entryId, onBack, onDeleted }: DiaryDetailProps) {
  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Lightbox
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false);

  // AI feedback re-fetch
  const [fetchingAI, setFetchingAI] = useState(false);
  // 流式预览（AI 回信逐字出现）
  const [streamingFeedback, setStreamingFeedback] = useState('');

  // ─── Load entry ──────────────────────────────────────────────────────────

  const loadEntry = useCallback(async () => {
    try {
      const data = await getEntry(entryId);
      if (data) setEntry(data);
    } finally {
      setLoading(false);
    }
  }, [entryId]);

  useEffect(() => {
    loadEntry();
  }, [loadEntry]);

  // ─── Edit handlers ───────────────────────────────────────────────────────

  function startEdit() {
    if (!entry) return;
    setEditContent(entry.content);
    setEditImages(entry.images || []);
    setEditing(true);
  }

  async function saveEdit() {
    if (!entry) return;
    setSavingEdit(true);
    try {
      const updates: Partial<DiaryEntry> = {
        content: editContent.trim(),
        images: editImages.length > 0 ? editImages : undefined,
      };
      await updateEntry(entryId, updates);
      setEntry({ ...entry, ...updates, wordCount: editContent.trim().length });
      setEditing(false);
    } catch (err) {
      console.error('Failed to update entry:', err);
    } finally {
      setSavingEdit(false);
    }
  }

  // ─── Delete handler ──────────────────────────────────────────────────────

  async function handleDelete() {
    try {
      await deleteEntry(entryId);
      onDeleted?.();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  }

  // ─── AI feedback re-fetch ────────────────────────────────────────────────

  async function refetchAIFeedback() {
    if (!entry) return;
    setFetchingAI(true);
    setStreamingFeedback('');
    try {
      const res = await fetch('/api/diary/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: entry.content, moodTags: entry.moodTags }),
      });

      if (!res.ok || !res.body) {
        setFetchingAI(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const line = event.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              fullText += data.content;
              // 流式渲染：增量提取 feedback 字段，实现打字机效果
              setStreamingFeedback(extractFeedbackPreview(fullText));
            } else if (data.type === 'done') {
              fullText = data.content;
            }
          } catch {}
        }
      }

      // Process remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.type === 'text') {
            fullText += data.content;
            setStreamingFeedback(extractFeedbackPreview(fullText));
          } else if (data.type === 'done') {
            fullText = data.content;
          }
        } catch {}
      }

      const result = extractJSON(fullText);
      if (result) {
        const updates: Partial<DiaryEntry> = {
          aiFeedback: result.feedback || '',
          moodTags: result.moodTags || entry.moodTags,
          keyThemes: result.keyThemes || [],
        };
        await updateEntry(entryId, updates);
        setEntry({ ...entry, ...updates });
      }
    } catch (err) {
      console.error('Failed to fetch AI feedback:', err);
    } finally {
      setFetchingAI(false);
      setStreamingFeedback('');
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-[var(--text-secondary)]">日记不存在</p>
        <button
          onClick={onBack}
          className="text-sm px-4 py-2 rounded-lg bg-white/60 backdrop-blur-sm hover:bg-white/80 transition-colors text-[var(--text-primary)]"
        >
          返回列表
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full overflow-y-auto pb-6"
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/40 transition-colors"
            aria-label="返回"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {formatDate(entry.createdAt)}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="p-2 rounded-lg hover:bg-white/40 transition-colors"
                aria-label="取消编辑"
              >
                <X className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="p-2 rounded-lg hover:bg-white/40 transition-colors"
                aria-label="保存"
              >
                {savingEdit ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                ) : (
                  <Save className="w-4 h-4 text-[var(--accent)]" />
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startEdit}
                className="p-2 rounded-lg hover:bg-white/40 transition-colors"
                aria-label="编辑"
              >
                <Edit3 className="w-4 h-4 text-[var(--text-secondary)]" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Delete Confirmation ────────────────────────────────────────────── */}
      {confirmDelete && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mb-4 p-3 rounded-xl bg-red-50/80 border border-red-100 flex items-center justify-between"
        >
          <span className="text-sm text-red-600">确定删除这篇日记吗？</span>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/80 text-[var(--text-secondary)] hover:bg-white transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDelete}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              删除
            </button>
          </div>
        </motion.div>
      )}

      {/* ─── Mood Tags ──────────────────────────────────────────────────────── */}
      {entry.moodTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {entry.moodTags.map((tag) => (
            <span
              key={tag}
              className="bg-teal-50/50 text-teal-500/70 rounded-full px-3 py-1 text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ─── Content ─────────────────────────────────────────────────────── */}
      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-5 mb-4">
        {editing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[200px] resize-none bg-transparent text-[15px] leading-[1.8] text-[var(--text-primary)] focus:outline-none"
          />
        ) : (
          <div className="text-[15px] leading-[1.8] text-[var(--text-primary)] whitespace-pre-wrap space-y-4">
            {entry.content}
          </div>
        )}
      </div>

      {/* ─── Images ───────────────────────────────────────────────────────── */}
      {editing ? (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {editImages.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/60">
                <img src={src} alt={`图片 ${i + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => setEditImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {editImages.length < 8 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const remaining = 8 - editImages.length;
                    const toProcess = Array.from(files).slice(0, remaining);
                    const compressed = await Promise.all(toProcess.map((f) => compressImage(f).catch(() => null)));
                    const valid = compressed.filter((r): r is string => r !== null);
                    setEditImages((prev) => [...prev, ...valid]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300/50 flex flex-col items-center justify-center gap-0.5 hover:border-[var(--accent)]/40 hover:bg-white/30 transition-all"
                >
                  <ImagePlus size={18} className="text-gray-300" />
                  <span className="text-[10px] text-gray-300">{editImages.length}/8</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : entry.images && entry.images.length > 0 ? (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {entry.images.map((src, i) => (
              <button
                key={i}
                onClick={() => setLightboxIdx(i)}
                className="w-20 h-20 rounded-lg overflow-hidden border border-white/60 hover:ring-2 hover:ring-[var(--accent)]/30 transition-all"
              >
                <img src={src} alt={`图片 ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─── Lightbox ──────────────────────────────────────────────────────── */}
      {lightboxIdx !== null && entry.images && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            onClick={() => setLightboxIdx(null)}
            className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
          >
            <X size={20} />
          </button>
          {/* 上一张 */}
          {lightboxIdx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
              className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <img
            src={entry.images[lightboxIdx]}
            alt={`图片 ${lightboxIdx + 1}`}
            className="max-w-[90vw] max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {/* 下一张 */}
          {lightboxIdx < entry.images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
              className="absolute right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <ArrowLeft size={20} className="rotate-180" />
            </button>
          )}
          <span className="absolute bottom-6 text-sm text-white/60">
            {lightboxIdx + 1} / {entry.images.length}
          </span>
        </div>
      )}

      {/* ─── Bottom Info ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs text-[var(--text-secondary)]">
          {entry.wordCount} 字
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {formatTime(entry.createdAt)}
        </span>
      </div>

      {/* ─── AI Feedback Card ───────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-purple-50/80 via-indigo-50/60 to-pink-50/70 backdrop-blur-sm border border-purple-100/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-purple-700">未来回音</span>
        </div>

        {fetchingAI && streamingFeedback ? (
          /* 流式输出中：逐字显示回信 */
          <>
            <RichText content={streamingFeedback} />
            <span className="inline-block w-1 h-3.5 bg-purple-400 ml-0.5 animate-pulse rounded-full mt-2" />
          </>
        ) : fetchingAI ? (
          /* 等待首 token（AI 思考中） */
          <div className="flex items-center gap-2 text-sm text-purple-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>AI 正在思考中...</span>
          </div>
        ) : entry.aiFeedback ? (
          <>
            <RichText content={entry.aiFeedback} />
            {entry.keyThemes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {entry.keyThemes.map((theme) => (
                  <span
                    key={theme}
                    className="bg-teal-50/50 text-teal-500/70 rounded-full px-2.5 py-0.5 text-xs"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={refetchAIFeedback}
              className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>获取 AI 回信</span>
            </button>
          </div>
        )}

        {/* Re-fetch button when feedback exists */}
        {entry.aiFeedback && !fetchingAI && (
          <button
            onClick={refetchAIFeedback}
            disabled={fetchingAI}
            className="mt-3 flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-3 h-3" />
            <span>重新获取</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
