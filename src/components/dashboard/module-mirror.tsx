'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Square, Image, Paperclip, Sparkles, Plus, ChevronLeft, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  addMessage,
  listMessagesBySession,
  createSession,
  listSessions,
  deleteSession,
  type MirrorMessage,
  type MirrorSession,
} from '@/lib/storage/mirror-store';
import { buildUserProfilePrompt } from '@/lib/ai/prompts/mirror-insight';
import { buildRecommendedTopics, FALLBACK_PROMPTS } from '@/lib/ai/recommend-topics';
import { RichText } from '@/components/shared/rich-text';

// ─── Component ───────────────────────────────────────────────────────────────

interface ModuleMirrorProps {
  sessionId?: number | null;
  onSessionCreated?: (id: number) => void;
  initialQuestion?: string;
}

export function ModuleMirror({ sessionId, onSessionCreated, initialQuestion }: ModuleMirrorProps) {
  const [messages, setMessages] = useState<MirrorMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [userProfile, setUserProfile] = useState<string>('');
  const [initialQuestionSent, setInitialQuestionSent] = useState(false);
  // 推荐话题：基于最近数据动态生成（加载完成前用静态话题兜底）
  const [quickPrompts, setQuickPrompts] = useState<string[]>([]);

  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [fileAttachment, setFileAttachment] = useState<{ name: string; content: string } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // 同步发送锁：防止快速连点/双击导致重复发送（state 更新是异步的，isStreaming 无法即时拦截）
  const sendingRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSendRef = useRef<((overrideInput?: string) => Promise<void>) | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadMessages();
    loadProfile();
    // 动态推荐话题：从最近数据（日记/Todo/知识库/心智日志）提取
    let isMounted = true;
    buildRecommendedTopics(4)
      .then((qs) => { if (isMounted) setQuickPrompts(qs.map((q) => q.text)); })
      .catch(() => {});
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamText]);

  // 自动发送初始问题（从仪表盘推荐卡跳转）
  useEffect(() => {
    if (!initialQuestion || initialQuestionSent || isStreaming) return;
    // 不再阻塞等待 userProfile —— 画像可以后续注入，先让问题发出去
    setInitialQuestionSent(true);
    const timer = setTimeout(() => {
      // 使用 ref 调用最新的 handleSend，避免闭包陈旧问题
      handleSendRef.current?.(initialQuestion);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion, initialQuestionSent, isStreaming]);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  async function loadMessages() {
    try {
      if (sessionId) {
        const msgs = await listMessagesBySession(sessionId);
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    } catch {
      // Silent fail
    }
  }

  async function loadProfile() {
    try {
      // 添加超时保护：3 秒内未完成则放弃，避免 IndexedDB 卡死阻塞整个组件
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve(''), 3000));
      const profile = await Promise.race([buildUserProfilePrompt(), timeout]);
      setUserProfile(profile || '暂无用户画像数据');
    } catch (e) {
      console.error('[mirror] loadProfile error:', e);
      setUserProfile('画像加载失败');
    }
  }

  function scrollToBottom() {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // ─── Send Message ──────────────────────────────────────────────────────────

  const handleSend = useCallback(async (overrideInput?: string) => {
    const text = overrideInput ?? input;
    if (!text.trim() && !imageAttachment) return;
    if (isStreaming) return;
    // 同步锁：即使 isStreaming 尚未更新（React state 异步），也能拦截第二次点击
    if (sendingRef.current) return;
    sendingRef.current = true;

    // 如果没有 sessionId，自动创建新会话
    let sid = sessionId;
    try {
      if (!sid) {
        sid = await createSession('新对话');
        onSessionCreated?.(sid);
      }
    } catch (e) {
      console.error('[mirror] createSession failed:', e);
      // IndexedDB 失败时不阻塞发送，用临时 sid
      sid = sid ?? Date.now();
    }

    // 1. Build user message
    const userMsg: Omit<MirrorMessage, 'id'> = {
      sessionId: sid,
      role: 'user',
      content: text,
      attachments: [],
      createdAt: new Date().toISOString(),
    };
    if (imageAttachment) {
      userMsg.attachments!.push({ type: 'image', name: '图片', data: imageAttachment });
    }
    if (fileAttachment) {
      userMsg.attachments!.push({ type: 'file', name: fileAttachment.name, data: fileAttachment.content });
      userMsg.content += `\n\n---\n附件内容（${fileAttachment.name}）：\n${fileAttachment.content}`;
    }

    // 2. Save user message & update UI
    const currentImageAttachment = imageAttachment;
    const currentFileAttachment = fileAttachment;
    try {
      await addMessage(userMsg);
    } catch (e) {
      console.error('[mirror] addMessage failed:', e);
      // IndexedDB 写入失败不阻塞 UI 和 API 调用
    }
    setMessages(prev => [...prev, { ...userMsg, id: Date.now() }]);
    setInput('');
    setImageAttachment(null);
    setFileAttachment(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 3. Start streaming
    setIsStreaming(true);
    setStreamText('');
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));

      console.log('[mirror] sending fetch to /api/mirror/chat, msgLen:', userMsg.content.length);
      const res = await fetch('/api/mirror/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          imageBase64: currentImageAttachment || undefined,
          history,
          userProfile,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }

      // 4. Parse SSE stream
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(event.slice(6));
            if (data.type === 'text') {
              fullText += data.content;
              setStreamText(fullText);
            } else if (data.type === 'done') {
              if (data.content) fullText = data.content;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      // Handle remaining buffer
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.type === 'text') {
            fullText += data.content;
            setStreamText(fullText);
          } else if (data.type === 'done') {
            if (data.content) fullText = data.content;
          }
        } catch {
          // Ignore
        }
      }

      // 5. Save AI reply
      const assistantMsg: Omit<MirrorMessage, 'id'> = {
        sessionId: sid,
        role: 'assistant',
        content: fullText,
        createdAt: new Date().toISOString(),
      };
      await addMessage(assistantMsg);
      setMessages(prev => [...prev, { ...assistantMsg, id: Date.now() }]);

    } catch (err: any) {
      console.error('[mirror] handleSend error:', err);
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, {
          id: Date.now(),
          sessionId: sid,
          role: 'assistant',
          content: `回答生成失败: ${err.message || '未知错误'}`,
          createdAt: new Date().toISOString(),
        }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamText('');
      abortRef.current = null;
      sendingRef.current = false;
    }
  }, [input, imageAttachment, fileAttachment, isStreaming, messages, userProfile, sessionId, onSessionCreated]);

  // 保持 ref 指向最新的 handleSend
  handleSendRef.current = handleSend;

  // ─── Stop Stream ───────────────────────────────────────────────────────────

  function handleStop() {
    abortRef.current?.abort();
  }

  // ─── File Handlers ─────────────────────────────────────────────────────────

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageAttachment(ev.target?.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setFileAttachment({ name: file.name, content: ev.target?.result as string });
    reader.readAsText(file);
    e.target.value = '';
  }

  // ─── Keyboard Handler ──────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Auto-resize Textarea ──────────────────────────────────────────────────

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 96) + 'px'; // max ~4 lines
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Area 2: Messages List */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 px-1 min-h-0">
        {messages.length === 0 && !isStreaming ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Sparkles size={28} className="text-purple-300 mb-3" />
            <p className="text-sm text-gray-500 mb-4 leading-relaxed">
              我是你的镜像洞察伙伴，了解你的思维轨迹和情感变化。试试问我...
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(quickPrompts.length > 0 ? quickPrompts : FALLBACK_PROMPTS.slice(0, 4)).map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  className="px-3 py-1.5 text-xs bg-teal-50/60 border border-teal-100/50 rounded-xl text-teal-800 hover:bg-teal-100/60 hover:border-teal-200/60 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'bg-teal-50 rounded-xl rounded-tr-sm p-3 max-w-[80%] ml-auto'
                      : 'bg-white/80 rounded-xl rounded-tl-sm p-3 max-w-[80%]'
                  }
                >
                  {/* Attachments */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.attachments.map((att, idx) => (
                        <div key={idx}>
                          {att.type === 'image' ? (
                            <img
                              src={att.data}
                              alt={att.name}
                              className="max-h-32 rounded-lg object-contain"
                            />
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">
                              <Paperclip size={10} />
                              {att.name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.role === 'user' ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  ) : (
                    <RichText content={msg.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {isStreaming && streamText && (
              <div className="flex justify-start">
                <div className="bg-white/80 rounded-xl rounded-tl-sm p-3 max-w-[85%]">
                  <RichText content={streamText} />
                  <span className="inline-block w-1 h-3.5 bg-purple-400 ml-0.5 animate-pulse rounded-full" />
                </div>
              </div>
            )}

            {/* Streaming but no text yet（思考中） */}
            {isStreaming && !streamText && (
              <div className="flex justify-start">
                <div className="bg-white/80 rounded-xl rounded-tl-sm p-3 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">思考中...</span>
                </div>
              </div>
            )}

            <div />
          </>
        )}
      </div>

      {/* Area 3: Input Area */}
      <div className="flex-shrink-0 pt-3 border-t border-gray-100/60 mt-2">
        {/* Attachment Preview */}
        {(imageAttachment || fileAttachment) && (
          <div className="flex items-center gap-2 mb-2 px-1">
            {imageAttachment && (
              <div className="relative">
                <img
                  src={imageAttachment}
                  alt="附件图片"
                  className="h-10 w-10 rounded-lg object-cover border border-gray-200/60"
                />
                <button
                  onClick={() => setImageAttachment(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-red-400 text-white text-[8px] hover:bg-red-500"
                >
                  ×
                </button>
              </div>
            )}
            {fileAttachment && (
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100/80 rounded-lg">
                <Paperclip size={11} className="text-gray-400" />
                <span className="text-xs text-gray-500 max-w-[120px] truncate">{fileAttachment.name}</span>
                <button
                  onClick={() => setFileAttachment(null)}
                  className="ml-1 text-gray-400 hover:text-red-400"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="输入你的问题或想法..."
          disabled={isStreaming}
          rows={1}
          className="w-full resize-none rounded-xl bg-white/60 border border-gray-200/60 px-3 py-2.5 text-sm outline-none focus:border-purple-300 transition-colors disabled:opacity-50 leading-relaxed"
          style={{ maxHeight: '96px' }}
        />

        {/* Toolbar */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isStreaming}
              className="p-2 rounded-lg hover:bg-gray-100/60 transition-colors disabled:opacity-40"
            >
              <Image size={16} className="text-gray-400" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="p-2 rounded-lg hover:bg-gray-100/60 transition-colors disabled:opacity-40"
            >
              <Paperclip size={16} className="text-gray-400" />
            </button>
          </div>

          <div>
            {isStreaming ? (
              <button
                onClick={handleStop}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors"
              >
                <Square size={16} className="text-red-400" />
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() && !imageAttachment}
                className="p-2 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors disabled:opacity-40 disabled:hover:bg-purple-50"
              >
                <Send size={16} className="text-purple-500" />
              </button>
            )}
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}

// ─── Session Sidebar ─────────────────────────────────────────────────────────

export function MirrorSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNew,
  onDelete,
  isOpen,
  onClose,
}: {
  sessions: MirrorSession[];
  activeSessionId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={onClose}
          />
          {/* 侧边栏 */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-[#fafaf8] border-r border-black/5 flex flex-col"
          >
            <div className="flex items-center justify-between px-4 pt-14 pb-3">
              <h2 className="text-sm font-medium text-gray-600">历史会话</h2>
              <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100/60">
                <ChevronLeft size={14} className="text-gray-400" />
              </button>
            </div>

            <button
              onClick={onNew}
              className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 border border-black/5 hover:bg-white/80 text-sm text-gray-500 hover:text-gray-700 transition-all"
            >
              <Plus size={14} />
              新对话
            </button>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
              {sessions.length === 0 ? (
                <p className="text-xs text-gray-300 text-center pt-8">暂无历史会话</p>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { onSelect(s.id!); onClose(); }}
                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                      s.id === activeSessionId
                        ? 'bg-purple-50/60 border border-purple-100/50'
                        : 'hover:bg-white/60 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 truncate">{s.title}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{s.updatedAt.slice(0, 10)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(s.id!); }}
                      className="opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 rounded transition-all"
                    >
                      <Trash2 size={12} className="text-gray-400" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
