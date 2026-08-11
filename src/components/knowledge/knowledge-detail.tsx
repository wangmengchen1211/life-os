'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Sparkles,
  ExternalLink,
  Link2,
  FileText,
  File,
  PenTool,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Save,
  AlertTriangle,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import {
  getItem,
  updateItem,
  deleteItem,
  listLinks,
  RELATION_TYPE_LABELS,
  DEFAULT_CATEGORIES,
  getTaggingContext,
  type KnowledgeItem,
  type KnowledgeLink,
  type RelationType,
} from '@/lib/storage/knowledge-store';
import { triggerAITagging } from '@/lib/ai/tagging';
import { safeText } from '@/lib/utils/safe-text';

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_RELATION_TYPES: RelationType[] = ['deepen', 'apply', 'supplement', 'oppose', 'source'];

const RELATION_COLORS: Record<string, string> = {
  deepen: '#c8d8e4',
  apply: '#d4a574',
  supplement: '#a8c5a0',
  oppose: '#b8a0c8',
  source: '#9ab0c0',
};

const CATEGORY_COLORS: Record<string, string> = {
  '认知与思维': '#7ecfc0',
  '学习与教育': '#66bb6a',
  '科学与技术': '#42a5f5',
  '人文与社科': '#ab47bc',
  '商业与职业': '#ffa726',
  '创意与表达': '#ef5350',
  '生活与健康': '#26c6da',
  '关系与沟通': '#ec407a',
  '财富与资源': '#ffca28',
  '兴趣与爱好': '#8d6e63',
  '社会与人文': '#78909c',
  '信念与内在': '#5c6bc0',
};

const RELATION_DISPLAY_ORDER = [...VALID_RELATION_TYPES] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

interface KnowledgeDetailProps {
  itemId: number;
  onBack?: () => void;
  onDeleted?: () => void;
}

interface LinkedItemInfo {
  link: KnowledgeLink;
  linkedItem?: KnowledgeItem;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTypeBadge(type: KnowledgeItem['type']) {
  const config: Record<
    KnowledgeItem['type'],
    { label: string; icon: React.ReactNode; classes: string }
  > = {
    link: {
      label: '链接',
      icon: <Link2 size={12} />,
      classes: 'bg-teal-50 text-teal-700 border-teal-200',
    },
    text: {
      label: '文本',
      icon: <FileText size={12} />,
      classes: 'bg-sky-50 text-sky-700 border-sky-200',
    },
    file: {
      label: '文件',
      icon: <File size={12} />,
      classes: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    creation_article: {
      label: '创作',
      icon: <PenTool size={12} />,
      classes: 'bg-violet-50 text-violet-700 border-violet-200',
    },
    feishu: {
      label: '飞书',
      icon: <FileText size={12} />,
      classes: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    },
    obsidian: {
      label: 'Obsidian',
      icon: <FileText size={12} />,
      classes: 'bg-purple-50 text-purple-700 border-purple-200',
    },
  };
  return config[type];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function KnowledgeDetail({
  itemId,
  onBack,
  onDeleted,
}: KnowledgeDetailProps) {
  const [item, setItem] = useState<KnowledgeItem | null>(null);
  const [linkedItems, setLinkedItems] = useState<LinkedItemInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editContent, setEditContent] = useState('');
  const [editSourceUrl, setEditSourceUrl] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Feature 1: Edit AI summary
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editSummary, setEditSummary] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  // Feature 3: Edit raw content inline (empty content card)
  const [isEditingRawContent, setIsEditingRawContent] = useState(false);
  const [editRawContentInline, setEditRawContentInline] = useState('');
  const [savingRawContent, setSavingRawContent] = useState(false);

  // Feature 4: AI retry
  const [isRetrying, setIsRetrying] = useState(false);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await getItem(itemId);
      if (!fetched) return;
      setItem(fetched);
      setEditTitle(safeText(fetched.title));
      setEditTags([...fetched.topicTags]);
      setEditContent(safeText(fetched.rawContent));
      setEditSourceUrl(safeText(fetched.sourceUrl));

      // Load related links
      const links = await listLinks(itemId);
      const linkedInfos: LinkedItemInfo[] = [];
      for (const link of links) {
        const linkedId = link.itemAId === itemId ? link.itemBId : link.itemAId;
        const linkedItem = await getItem(linkedId);
        linkedInfos.push({ link, linkedItem });
      }
      setLinkedItems(linkedInfos);
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await updateItem(itemId, {
        title: editTitle.trim(),
        topicTags: editTags,
        rawContent: editContent,
        sourceUrl: editSourceUrl.trim() || undefined,
      });
      setIsEditing(false);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteItem(itemId);
    onDeleted?.();
  };

  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  const handleCancelEdit = () => {
    if (item) {
      setEditTitle(safeText(item.title));
      setEditTags([...item.topicTags]);
      setEditContent(safeText(item.rawContent));
      setEditSourceUrl(safeText(item.sourceUrl));
    }
    setIsEditing(false);
  };

  const handleAIAnalyze = async () => {
    if (!item) return;
    setAiError(null);
    setAiAnalyzing(true);
    try {
      const rawText = safeText(item.rawContent).trim();
      const titleText = safeText(item.title).trim();
      const visibleChars = rawText.replace(/\s/g, '').length;

      if (visibleChars < 2) {
        // 仅当正文真的为空/几乎为空时拒绝，分开呈现 title / rawContent 长度，
        // 让用户一眼能看出是数据本身缺失还是格式解析问题。
        setAiError(
          `正文为空或仅含空白（title=${titleText.length} 字 / rawContent=${rawText.length} 字 / 可见字符=${visibleChars}）。` +
          `请点上方「编辑」手动粘贴正文后重试。`
        );
        return;
      }

      const ok = await triggerAITagging(itemId, titleText, rawText);
      if (!ok) {
        setAiError('AI 分析未返回有效结果，请打开浏览器控制台 (F12) 查看 [AI Tagging] 日志了解详情。可稍后重试或手动编辑标签。');
        return;
      }
      await loadData();
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI 分析异常');
    } finally {
      setAiAnalyzing(false);
    }
  };

  // ─── Feature 1: Save AI Summary ──────────────────────────────────────────────

  const handleStartEditSummary = () => {
    setEditSummary(safeText(item?.aiSummary));
    setIsEditingSummary(true);
  };

  const handleSaveSummary = async () => {
    if (!item) return;
    setSavingSummary(true);
    try {
      await updateItem(itemId, { aiSummary: editSummary.trim() });
      setIsEditingSummary(false);
      await loadData();
    } finally {
      setSavingSummary(false);
    }
  };

  const handleCancelEditSummary = () => {
    setIsEditingSummary(false);
    setEditSummary('');
  };

  // ─── Feature 2: Change Primary Category ────────────────────────────────────────

  const handleCategoryChange = async (newCategory: string) => {
    if (!item) return;
    await updateItem(itemId, { primaryCategory: newCategory });
    await loadData();
  };

  // ─── Feature 3: Save raw content from empty-content card ───────────────────────

  const handleStartEditRawContent = () => {
    setEditRawContentInline(safeText(item?.rawContent));
    setIsEditingRawContent(true);
  };

  const handleSaveRawContent = async () => {
    if (!item) return;
    setSavingRawContent(true);
    try {
      const text = editRawContentInline.trim();
      await updateItem(itemId, { rawContent: text });
      setIsEditingRawContent(false);
      await loadData();
      // Auto-trigger AI tagging after saving raw content
      if (text.length > 0) {
        setIsRetrying(true);
        try {
          const ctx = await getTaggingContext();
          await triggerAITagging(itemId, safeText(item.title), text, ctx);
          await loadData();
        } finally {
          setIsRetrying(false);
        }
      }
    } finally {
      setSavingRawContent(false);
    }
  };

  const handleCancelEditRawContent = () => {
    setIsEditingRawContent(false);
    setEditRawContentInline('');
  };

  // ─── Feature 4: Retry AI tagging ───────────────────────────────────────────────

  const handleRetryAITagging = async () => {
    if (!item) return;
    setIsRetrying(true);
    try {
      const rawText = safeText(item.rawContent).trim();
      const titleText = safeText(item.title).trim();
      const ctx = await getTaggingContext();
      await triggerAITagging(itemId, titleText, rawText, ctx);
      await loadData();
    } finally {
      setIsRetrying(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-teal-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          知识项未找到
        </p>
        <button
          onClick={onBack}
          className="px-4 py-2 text-xs rounded-lg bg-white/50 border border-white/60"
          style={{ color: 'var(--text-primary)' }}
        >
          返回列表
        </button>
      </div>
    );
  }

  const badge = getTypeBadge(item.type);
  const rawContent = isEditing ? editContent : safeText(item.rawContent);
  const shouldTruncate = !isEditing && !contentExpanded && rawContent.length > 200;
  const displayContent = shouldTruncate ? rawContent.slice(0, 200) + '...' : rawContent;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="h-full flex flex-col overflow-hidden min-h-0"
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between py-2 mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm rounded-lg px-2 py-1 hover:bg-white/60 transition-colors"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={16} />
          <span>返回</span>
        </button>
        <div className="flex items-center gap-1">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 rounded-lg hover:bg-teal-50 transition-colors"
                style={{ color: 'var(--accent)' }}
                title="编辑"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                title="删除"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Save size={14} />
                保存
              </button>
              <button
                onClick={handleCancelEdit}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/60 hover:bg-white/80 transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                取消
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="bg-red-50/80 backdrop-blur-sm rounded-xl p-3 mb-3 flex items-center justify-between">
          <span className="text-xs text-red-600">确定删除此知识项？此操作不可撤回。</span>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              确认删除
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 text-xs rounded-lg bg-white/80 hover:bg-white transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-6">
        {/* Title Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
          {/* Type Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full border ${badge.classes}`}
            >
              {badge.icon}
              {badge.label}
            </span>
          </div>

          {/* Title */}
          {isEditing ? (
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full text-lg font-semibold bg-white/60 rounded-lg px-3 py-2 outline-none border border-white/80 focus:border-[var(--accent)] transition-colors"
              style={{ color: 'var(--text-primary)' }}
            />
          ) : (
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              {safeText(item.title)}
            </h2>
          )}

          {/* Source Collection Info */}
          {!isEditing && item.sourceCollection && (
            <div className="flex items-center gap-1.5 mt-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/40 shrink-0">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <span className="text-xs text-white/40">
                来源：{item.sourceCollection}{item.sourcePosition ? ` / ${item.sourcePosition}` : ''}
              </span>
            </div>
          )}

          {/* Source URL */}
          {isEditing ? (
            <div className="mt-2">
              <label className="block text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                原文链接
              </label>
              <input
                type="url"
                value={editSourceUrl}
                onChange={(e) => setEditSourceUrl(e.target.value)}
                placeholder="粘贴公众号 / 网页原文链接（可留空）"
                className="w-full text-xs bg-white/60 rounded-lg px-3 py-1.5 outline-none border border-white/80 focus:border-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>
          ) : (
            item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs text-teal-600 hover:text-teal-800 transition-colors"
              >
                <ExternalLink size={12} />
                <span className="truncate max-w-[250px]">{item.sourceUrl}</span>
              </a>
            )
          )}

          {/* Created time */}
          <p className="mt-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            创建于 {formatDate(item.createdAt)}
          </p>
        </div>

        {/* AI Summary Card - Priority-based display */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
          {/* Priority 1: rawContent is empty → show empty content guidance card */}
          {!safeText(item.rawContent)?.trim() ? (
            <div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-800">正文为空</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                      该条目正文未能自动提取。请手动粘贴内容后重新解析。
                    </p>
                    {!isEditingRawContent ? (
                      <button
                        onClick={handleStartEditRawContent}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                      >
                        <Edit3 size={12} />
                        编辑正文
                      </button>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={editRawContentInline}
                          onChange={(e) => setEditRawContentInline(e.target.value)}
                          rows={6}
                          placeholder="粘贴文章正文内容..."
                          className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none border border-amber-200 focus:border-amber-400 resize-y transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveRawContent}
                            disabled={savingRawContent || !editRawContentInline.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                          >
                            {savingRawContent ? (
                              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            保存并解析
                          </button>
                          <button
                            onClick={handleCancelEditRawContent}
                            className="px-3 py-1.5 text-xs rounded-lg bg-white text-amber-700 hover:bg-amber-50 transition-colors"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {isRetrying && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
                  <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                  AI 解析中...
                </div>
              )}
            </div>
          ) : !item.aiSummary?.trim() ? (
            /* Priority 2: rawContent exists but aiSummary is empty → AI parse failure */
            <div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-4">
                <div className="flex items-start gap-2">
                  <RefreshCw size={18} className={`text-rose-500 shrink-0 mt-0.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-rose-800">AI 解析未完成</h4>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      可能因网络问题或内容格式导致解析失败
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={handleRetryAITagging}
                        disabled={isRetrying}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-100 text-rose-800 hover:bg-rose-200 transition-colors disabled:opacity-50"
                      >
                        {isRetrying ? (
                          <div className="w-3 h-3 border border-rose-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshCw size={12} />
                        )}
                        {isRetrying ? '解析中...' : '重新解析'}
                      </button>
                      <button
                        onClick={handleStartEditSummary}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-rose-700 border border-rose-200 hover:bg-rose-50 transition-colors"
                      >
                        <Edit3 size={12} />
                        手动编辑
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* If user chose to manually edit summary from error card */}
              {isEditingSummary && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={4}
                    placeholder="输入 AI 摘要..."
                    className="w-full text-sm bg-white rounded-lg px-3 py-2 outline-none border border-rose-200 focus:border-rose-400 resize-y transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveSummary}
                      disabled={savingSummary}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50"
                    >
                      {savingSummary ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      保存摘要
                    </button>
                    <button
                      onClick={handleCancelEditSummary}
                      className="px-3 py-1.5 text-xs rounded-lg bg-white text-rose-700 hover:bg-rose-50 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Priority 3: aiSummary exists → show summary with edit button */
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-400" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    AI 摘要
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {!isEditingSummary && (
                    <button
                      onClick={handleStartEditSummary}
                      className="p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                      title="编辑摘要"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                  <button
                    onClick={handleAIAnalyze}
                    disabled={aiAnalyzing}
                    className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    {aiAnalyzing ? (
                      <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    {aiAnalyzing ? '分析中...' : '重新分析'}
                  </button>
                </div>
              </div>
              {isEditingSummary ? (
                <div className="space-y-2">
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={4}
                    className="w-full text-sm bg-white/60 rounded-lg px-3 py-2 outline-none border border-white/80 focus:border-[var(--accent)] resize-y transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveSummary}
                      disabled={savingSummary}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {savingSummary ? (
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save size={12} />
                      )}
                      保存
                    </button>
                    <button
                      onClick={handleCancelEditSummary}
                      className="px-3 py-1.5 text-xs rounded-lg bg-white/60 hover:bg-white/80 transition-colors"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {safeText(item.aiSummary)}
                </p>
              )}
              {aiError && (
                <p className="mt-2 text-xs text-red-500">{aiError}</p>
              )}
            </div>
          )}
        </div>

        {/* Primary Category Badge + Dropdown */}
        {!isEditing && (
          <div className="flex items-center gap-2 flex-wrap">
            {item.primaryCategory && (
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
                style={{
                  backgroundColor: `${CATEGORY_COLORS[item.primaryCategory] || '#888888'}33`,
                  color: `${CATEGORY_COLORS[item.primaryCategory] || '#888888'}cc`,
                }}
              >
                {item.primaryCategory}
              </span>
            )}
            <select
              value={item.primaryCategory || ''}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="text-xs rounded-lg px-2 py-1.5 bg-white/60 border border-white/80 outline-none cursor-pointer hover:bg-white/80 focus:border-[var(--accent)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
            >
              <option value="" disabled>
                选择分类
              </option>
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tags Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            标签
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(isEditing ? editTags : item.topicTags).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-teal-50 text-teal-700 rounded-full"
              >
                {tag}
                {isEditing && (
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
            {isEditing && (
              <div className="inline-flex items-center gap-1">
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="新标签"
                  className="w-20 px-2 py-1 text-xs bg-white/60 rounded-full outline-none border border-white/80 focus:border-[var(--accent)]"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  onClick={handleAddTag}
                  className="p-1 rounded-full hover:bg-teal-50 transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            {!isEditing && item.topicTags.length === 0 && (
              <span className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
                还未贴上标签，等待你的命名
              </span>
            )}
          </div>
        </div>

        {/* Raw Content */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
          <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            原始内容
          </h3>
          {isEditing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={8}
              className="w-full text-sm bg-white/60 rounded-lg px-3 py-2 outline-none border border-white/80 focus:border-[var(--accent)] resize-y transition-colors"
              style={{ color: 'var(--text-primary)' }}
            />
          ) : rawContent ? (
            <div>
              <p
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text-secondary)' }}
              >
                {displayContent}
              </p>
              {rawContent.length > 200 && (
                <button
                  onClick={() => setContentExpanded(!contentExpanded)}
                  className="flex items-center gap-1 mt-2 text-xs hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--accent)' }}
                >
                  {contentExpanded ? (
                    <>
                      <ChevronUp size={14} /> 收起
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} /> 展开全文
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: 'var(--text-secondary)' }}>
              内容尚在路上，稍后再来看看
            </p>
          )}
        </div>

        {/* Related Knowledge - Grouped by Relation Type */}
        {linkedItems.length > 0 && (() => {
          const groupedLinks = linkedItems.reduce((groups, info) => {
            const type = info.link.relationType;
            if (!VALID_RELATION_TYPES.includes(type as RelationType)) return groups;
            if (!groups[type]) groups[type] = [];
            groups[type].push(info);
            return groups;
          }, {} as Record<string, LinkedItemInfo[]>);

          return (
            <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4">
              <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                关联知识
              </h3>
              <div className="space-y-4">
                {RELATION_DISPLAY_ORDER.filter((type) => groupedLinks[type]?.length).map((type) => (
                  <div key={type}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: RELATION_COLORS[type] }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: `${RELATION_COLORS[type]}cc` }}
                      >
                        {RELATION_TYPE_LABELS[type as RelationType]}
                      </span>
                    </div>
                    <div className="space-y-2 pl-3.5">
                      {groupedLinks[type].map(({ link, linkedItem }) => {
                        const linkedId = link.itemAId === itemId ? link.itemBId : link.itemAId;
                        return (
                          <button
                            key={link.id}
                            onClick={() => {
                              onBack?.();
                              setTimeout(() => {
                                window.dispatchEvent(
                                  new CustomEvent('knowledge-navigate', { detail: { itemId: linkedId } })
                                );
                              }, 50);
                            }}
                            className="w-full text-left p-2.5 rounded-lg bg-white/50 hover:bg-white/80 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <Link2 size={14} style={{ color: RELATION_COLORS[type] }} className="shrink-0" />
                              <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {safeText(linkedItem?.title) || `知识项 #${linkedId}`}
                              </span>
                            </div>
                            {link.aiReason && (
                              <div className="mt-1 ml-6">
                                <span className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                  {safeText(link.aiReason)}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}
