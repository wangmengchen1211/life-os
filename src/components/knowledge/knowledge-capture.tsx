'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, StickyNote, X, Image as ImageIcon, Link as LinkIcon, Paperclip, FolderOpen } from 'lucide-react';
import { addItem, updateItem, getTaggingContext } from '@/lib/storage/knowledge-store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeCaptureProps {
  onSaved?: () => void;
  onCancel?: () => void;
}

interface AnalysisResult {
  title?: string;
  summary: string;
  tags: string[];
  primaryCategory?: string;
  newTagReasons?: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractJSON(text: string): AnalysisResult | null {
  try {
    if (!text || text.trim().length === 0) return null;

    // 移除 markdown 代码块标记
    let cleaned = text.replace(/```(?:json)?\s*/g, '').trim();

    // 找到第一个 {
    const start = cleaned.indexOf('{');
    if (start === -1) return null;

    // 从 start 开始，用括号计数找到匹配的 }
    let braceCount = 0;
    let end = -1;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') braceCount++;
      else if (cleaned[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          end = i;
          break;
        }
      }
    }

    if (end === -1) return null;

    const jsonStr = cleaned.slice(start, end + 1);
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[AI Tagging] JSON parse failed:', error instanceof Error ? error.message : String(error), 'Text preview:', text.slice(0, 300));
    return null;
  }
}

function detectType(text: string, hasImage: boolean): 'link' | 'text' | 'file' {
  if (hasImage) return 'file';
  
  const urlPattern = /https?:\/\/[^\s]+/gi;
  const urls = text.match(urlPattern) || [];
  
  if (urls.length === 0) return 'text';
  
  // 计算 URL 与纯文本的比重
  const urlTotalLength = urls.reduce((sum, url) => sum + url.length, 0);
  const cleanText = text.replace(urlPattern, '').trim();
  const textLength = cleanText.length;
  
  // 纯URL
  if (textLength === 0) return 'link';
  
  // URL占比高，或者文本部分很短（仅是标题）
  const urlRatio = urlTotalLength / (urlTotalLength + textLength);
  const isTitleOnlyFormat = textLength < 100 && urls.length >= 1;
  
  return (urlRatio >= 0.5 || isTitleOnlyFormat) ? 'link' : 'text';
}

function isUrl(text: string): boolean {
  return /https?:\/\/[^\s]+/i.test(text);
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

// ─── Background AI Analysis (independent of component lifecycle) ─────────────

async function triggerBackgroundAnalysis(itemId: number, content: string, title?: string, imageBase64?: string) {
  let analysisContent = content;
  let analysisTitle = title;

  // If content contains a URL, try to extract page content server-side
  const detectedUrl = extractUrl(content);
  if (!imageBase64 && detectedUrl) {
    try {
      const extractRes = await fetch('/api/knowledge/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: detectedUrl }),
      });
      if (extractRes.ok) {
        const extracted = await extractRes.json();
        if (extracted.content && extracted.content.length > 50) {
          analysisContent = extracted.content;
          analysisTitle = extracted.title || analysisTitle;
        }
      }
    } catch {
      // Extraction failed, use URL itself as content
      analysisContent = `链接：${detectedUrl}`;
    }
  }

  // 获取打标上下文（已有标签 + 一级主题列表）
  let existingTags: string[] = [];
  let categories: string[] = [];
  try {
    const ctx = await getTaggingContext();
    existingTags = ctx.existingTags;
    categories = ctx.categories;
  } catch {
    // 获取失败时使用空数组，不影响主流程
  }

  // Call AI analysis
  try {
    const res = await fetch('/api/knowledge/tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: analysisContent,
        title: analysisTitle,
        imageBase64: imageBase64 || undefined,
        existingTags,
        categories,
      }),
    });

    if (!res.ok || !res.body) {
      console.error(`[AI分析] 请求失败: ${res.status} ${res.statusText}, itemId: ${itemId}`);
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
          if (data.type === 'text') fullText += data.content;
          else if (data.type === 'done') fullText = data.content;
          else if (data.type === 'error') return;
        } catch (parseErr) {
          console.warn(`[AI分析] SSE解析错误:`, parseErr);
        }
      }
    }

    // Handle remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (data.type === 'text') fullText += data.content;
        else if (data.type === 'done') fullText = data.content;
      } catch {
        // Ignore
      }
    }

    const result = extractJSON(fullText);
    if (result) {
      await updateItem(itemId, {
        title: result.title || analysisTitle || undefined,
        aiSummary: result.summary || '',
        topicTags: result.tags || [],
        primaryCategory: result.primaryCategory || undefined,
      });

      // Trigger link analysis after tags are done
      triggerLinkAnalysis(itemId, result.title || analysisTitle, result.summary, result.tags);
    } else {
      console.error(`[AI分析] 解析AI响应失败, itemId: ${itemId}, response: ${fullText.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[AI分析] 异常: ${err instanceof Error ? err.message : String(err)}, itemId: ${itemId}`);
  }
}

// ─── Background AI Link Analysis ─────────────────────────────────────────────

async function triggerLinkAnalysis(
  itemId: number,
  title?: string,
  summary?: string,
  tags?: string[]
) {
  try {
    const { listItems, addLink } = await import('@/lib/storage/knowledge-store');

    // Get all existing items (exclude self)
    const allItems = await listItems();
    const existingItems = allItems
      .filter(item => item.id !== itemId)
      .map(item => ({ id: item.id!, title: item.title, tags: item.topicTags }));

    if (existingItems.length === 0) return;

    // Limit to 30 items for AI (avoid token explosion)
    const itemsForAI = existingItems.slice(0, 30);

    const res = await fetch('/api/knowledge/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newItem: { title: title || '未命名', summary, tags },
        existingItems: itemsForAI,
      }),
    });

    if (!res.ok || !res.body) return;

    // SSE stream parsing
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
          if (data.type === 'text') fullText += data.content;
          else if (data.type === 'done') fullText = data.content;
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Handle remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (data.type === 'text') fullText += data.content;
        else if (data.type === 'done') fullText = data.content;
      } catch {
        // Ignore
      }
    }

    const result = extractJSON(fullText) as any;
    if (result && Array.isArray(result.links)) {
      for (const link of result.links) {
        if (link.id && typeof link.id === 'number') {
          await addLink({
            itemAId: itemId,
            itemBId: link.id,
            relationType: link.relationType || 'supplement',
            aiReason: link.reason || '内容相关',
          });
        }
      }
    }
  } catch {
    // Silent fail - don't affect main flow
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeCapture({ onSaved, onCancel }: KnowledgeCaptureProps) {
  const [content, setContent] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [imageData, setImageData] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [sourceCollection, setSourceCollection] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Image Paste Handler ──────────────────────────────────────────────────

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setImageData(base64);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  // ─── File Select Handler ────────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setImageData(base64);
        setSelectedFileName(file.name);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setContent(text);
        setSelectedFileName(file.name);
      };
      reader.readAsText(file);
    }

    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // ─── URL Content Extraction ───────────────────────────────────────────────

  async function handleContentChange(value: string) {
    setContent(value);

    // Auto-detect URL and extract content
    const detectedUrlInInput = extractUrl(value);
    if (detectedUrlInInput && !extracting && !extractedContent) {
      setExtracting(true);
      try {
        const res = await fetch('/api/knowledge/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: detectedUrlInInput }),
        });
        if (res.ok) {
          const data = await res.json();
          setExtractedContent(data.content || null);
          setExtractedTitle(data.title || null);
        }
      } catch {
        // Silent fail
      } finally {
        setExtracting(false);
      }
    }

    // Reset extracted content if user changes away from URL
    if (!isUrl(value)) {
      setExtractedContent(null);
      setExtractedTitle(null);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!content.trim() && !imageData) return;
    setSaving(true);

    try {
      const hasImage = !!imageData;
      const type = detectType(content, hasImage);

      // Temporary title (will be replaced by AI)
      let title: string;
      if (hasImage) {
        title = '图片笔记';
      } else if (type === 'link' && extractedTitle) {
        title = extractedTitle;
      } else {
        title = content.trim().slice(0, 50);
      }

      // Build rawContent for storage
      let rawContent: string;
      if (hasImage) {
        rawContent = imageData!;
      } else {
        rawContent = content.trim();
      }

      // 1. Save to IndexedDB immediately
      const resolvedSource = sourceCollection.trim()
        || (type === 'link' ? '网页收集' : '手动收集');

      const id = await addItem({
        type,
        title,
        sourceUrl: type === 'link' ? (extractUrl(content) || content.trim()) : undefined,
        rawContent,
        topicTags: [],
        aiSummary: note.trim() || undefined,
        sourceCollection: resolvedSource,
      });

      // 2. Background AI analysis (non-blocking, independent of component)
      // For URLs: the standalone function will re-extract content server-side
      // For text: pass the content directly
      // For images: pass image base64 to AI for vision analysis
      if (hasImage) {
        triggerBackgroundAnalysis(id, note.trim() || '请分析图片内容', undefined, imageData!);
      } else {
        triggerBackgroundAnalysis(id, content.trim(), type === 'link' && extractedTitle ? extractedTitle : undefined);
      }

      setSaving(false);
      onSaved?.();
    } catch {
      setSaving(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onCancel}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/50 border border-white/60 hover:bg-white/70 transition-colors"
        >
          <ArrowLeft size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
        <h2 className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
          收录知识
        </h2>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {/* Primary Input */}
        <div>
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onPaste={handlePaste}
            placeholder="粘贴链接、文本或图片..."
            className="w-full min-h-[120px] rounded-xl bg-white/50 border border-white/60 p-4 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          />
          {/* File Upload Button */}
          <div className="flex items-center gap-2 mt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.txt,.md"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/50 border border-white/60 hover:bg-white/70 transition-colors text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Paperclip size={14} />
              上传文件
            </button>
            {selectedFileName && !imageData && (
              <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                📄 {selectedFileName}
                <button
                  onClick={() => setSelectedFileName(null)}
                  className="ml-1 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Image Preview */}
        {imageData && (
          <div className="relative inline-block">
            <img
              src={imageData}
              alt="粘贴的图片"
              className="max-h-[160px] rounded-lg border border-white/60 object-contain"
            />
            <button
              onClick={() => setImageData(null)}
              className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition-colors"
            >
              <X size={12} />
            </button>
            <div className="flex items-center gap-1 mt-1.5">
              <ImageIcon size={11} style={{ color: 'var(--text-secondary)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>图片已就绪</span>
            </div>
          </div>
        )}

        {/* URL Extraction Status */}
        {isUrl(content) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/30 border border-white/50">
            <LinkIcon size={12} style={{ color: 'var(--accent)' }} />
            {extracting ? (
              <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 size={11} className="animate-spin" />
                正在提取页面内容...
              </span>
            ) : extractedContent ? (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                已提取内容（{extractedContent.length} 字符）
              </span>
            ) : (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                链接将自动提取内容
              </span>
            )}
          </div>
        )}

        {/* Note Input */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <StickyNote size={12} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              笔记（可选）
            </span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="添加笔记（可选）"
            className="w-full min-h-[60px] rounded-xl bg-white/50 border border-white/60 p-4 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none leading-relaxed"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* Source Collection Input */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <FolderOpen size={12} style={{ color: 'var(--text-secondary)' }} />
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              来源集（可选）
            </span>
          </div>
          <input
            type="text"
            value={sourceCollection}
            onChange={(e) => setSourceCollection(e.target.value)}
            placeholder="手动收集"
            className="w-full rounded-xl bg-white/50 border border-white/60 px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-colors"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 mt-auto">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg transition-colors hover:bg-white/50"
          style={{ color: 'var(--text-secondary)' }}
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={(!content.trim() && !imageData) || saving}
          className="flex items-center gap-2 bg-[var(--accent)] text-white rounded-lg px-6 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
        >
          {saving ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save size={15} />
              收录
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}
