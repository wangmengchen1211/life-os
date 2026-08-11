'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, ImagePlus, X, Calendar } from 'lucide-react';
import { addEntry } from '@/lib/storage/diary-store';
import { compressImage } from '@/lib/utils/image-compress';
import { toDateInputValue, dateInputToISO } from '@/lib/utils/date';
import { useToast } from '@/components/shared/toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiaryWriteProps {
  onSaved?: () => void;
  onCancel?: () => void;
  /** 预填日期（ISO 字符串），缺省为今天 */
  initialDate?: string;
}

// ─── Mood Options ────────────────────────────────────────────────────────────

const MAX_IMAGES = 8;
const MOOD_OPTIONS = ['开心', '平静', '疲惫', '焦虑', '感恩', '难过', '兴奋', '思考'];

// ─── Background AI Feedback (independent of component lifecycle) ─────────────

async function fetchDiaryFeedback(content: string, moodTags: string[]): Promise<any | null> {
  try {
    const res = await fetch('/api/diary/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, moodTags }),
    });

    if (!res.ok || !res.body) return null;

    // SSE 流解析
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let streamError = false;

    const handleEvent = (raw: string) => {
      const line = raw.trim();
      if (!line.startsWith('data: ')) return;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'text') fullText += data.content;
        else if (data.type === 'done') fullText = data.content;
        else if (data.type === 'error') streamError = true;
      } catch {}
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) handleEvent(event);
    }

    // 处理残留 buffer（跳过心跳帧 `: keep-alive`）
    if (buffer.trim().startsWith('data: ')) handleEvent(buffer);

    if (streamError) return null;
    return extractJSON(fullText);
  } catch (err) {
    console.warn('AI反馈获取失败:', err);
    return null;
  }
}

async function triggerDiaryFeedback(entryId: number, content: string, moodTags: string[]) {
  // 失败（网络/双通道全挂/JSON 解析失败）自动重试一次
  let result = await fetchDiaryFeedback(content, moodTags);
  if (!result || !result.feedback) {
    result = await fetchDiaryFeedback(content, moodTags);
  }

  if (result && result.feedback) {
    const { updateEntry } = await import('@/lib/storage/diary-store');
    await updateEntry(entryId, {
      aiFeedback: result.feedback,
      moodTags: result.moodTags || moodTags,
      keyThemes: result.keyThemes || [],
    }).catch(() => {});
  }
}

function extractJSON(text: string): any {
  try {
    let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DiaryWrite({ onSaved, onCancel, initialDate }: DiaryWriteProps) {
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // 日记日期（YYYY-MM-DD）：日历点选日期进入时预填该日期，否则为今天
  const [dateValue, setDateValue] = useState(() =>
    toDateInputValue(initialDate ?? new Date().toISOString()),
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const wordCount = content.length;
  const isToday = dateValue === toDateInputValue(new Date().toISOString());

  function toggleMood(mood: string) {
    setSelectedMoods((prev) => {
      if (prev.includes(mood)) {
        return prev.filter((m) => m !== mood);
      }
      if (prev.length >= 3) return prev;
      return [...prev, mood];
    });
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast('info', `最多上传 ${MAX_IMAGES} 张图片`);
      return;
    }

    const toProcess = Array.from(files).slice(0, remaining);
    try {
      const compressed = await Promise.all(
        toProcess.map((f) => compressImage(f)),
      );
      setImages((prev) => [...prev, ...compressed]);
    } catch {
      toast('error', '图片处理失败');
    }

    // 重置 input 以便重复选择
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!content.trim()) {
      toast('info', '请先写点什么');
      return;
    }

    setSaving(true);
    try {
      const entryId = await addEntry({
        content: content.trim(),
        moodTags: selectedMoods,
        keyThemes: [],
        images: images.length > 0 ? images : undefined,
        // 按所选日期落库（本地中午转 ISO，避免时区偏移导致日期跳变）
        createdAt: dateInputToISO(dateValue),
      });

      // 后台静默触发 AI 反馈（不阻塞用户）
      triggerDiaryFeedback(entryId, content.trim(), selectedMoods);

      toast('success', '日记已保存');
      onSaved?.();
    } catch (err) {
      console.error('Failed to save diary entry:', err);
      toast('error', '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full overflow-hidden"
    >
      {/* 顶部导航 */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-white/40 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">写日记</h2>
      </div>

      {/* 可滚动内容区：图片多时只滚动中间区域，底部保存栏始终可见 */}
      <div className="flex-1 min-h-0 overflow-y-auto mb-4">
        <div className="flex flex-col min-h-full">
      {/* 日记日期选择（支持补写过去/未来的日记） */}
      <div className="mb-3 flex items-center gap-2">
        <Calendar size={15} className="text-[var(--text-secondary)] shrink-0" />
        <input
          type="date"
          value={dateValue}
          onChange={(e) => setDateValue(e.target.value)}
          className="text-sm bg-white/50 border border-white/60 rounded-lg px-3 py-1.5 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all"
        />
        {isToday && (
          <span className="text-xs text-[var(--text-secondary)]">今天</span>
        )}
      </div>

      {/* 情绪标签选择器 */}
      <div className="mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1">
          {MOOD_OPTIONS.map((mood) => {
            const isSelected = selectedMoods.includes(mood);
            return (
              <button
                key={mood}
                onClick={() => toggleMood(mood)}
                className={`
                  shrink-0 rounded-full px-3 py-1.5 text-sm border transition-all
                  ${
                    isSelected
                      ? 'bg-purple-100 text-purple-700 border-purple-300'
                      : 'bg-white/50 text-[var(--text-secondary)] border-white/60 hover:border-purple-200'
                  }
                `}
              >
                {mood}
              </button>
            );
          })}
        </div>
      </div>

      {/* textarea 主编辑区 */}
      <div className="flex-1 relative mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="今天想记录点什么..."
          className="w-full h-full min-h-[200px] resize-none rounded-xl bg-white/50 border border-white/60 p-4 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50 transition-all"
        />
      </div>

      {/* 图片区域 */}
      {images.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/60">
                <img
                  src={src}
                  alt={`图片 ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-red-500 transition-colors"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300/50 flex flex-col items-center justify-center gap-0.5 hover:border-[var(--accent)]/40 hover:bg-white/30 transition-all"
              >
                <ImagePlus size={18} className="text-gray-300" />
                <span className="text-[10px] text-gray-300">{images.length}/{MAX_IMAGES}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 隐藏的文件选择器 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />
        </div>
      </div>

      {/* 底部栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 字数统计 */}
          <span className="text-xs text-[var(--text-secondary)]">
            {wordCount} 字
          </span>
          {/* 添加图片按钮 */}
          {images.length < MAX_IMAGES && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/50 border border-white/60 hover:bg-white/70 transition-colors text-xs text-[var(--text-secondary)]"
            >
              <ImagePlus size={13} />
              {images.length > 0 ? `${images.length}/${MAX_IMAGES}` : '图片'}
            </button>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-white/40 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            保存
          </button>
        </div>
      </div>
    </motion.div>
  );
}
