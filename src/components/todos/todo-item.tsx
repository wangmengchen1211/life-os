'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2, CalendarDays } from 'lucide-react';

interface TodoItemProps {
  todo: { id: number; title: string; date: string; isCompleted: boolean; completedAt?: string };
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  /** 编辑保存：标题 / 日期 */
  onUpdate: (id: number, updates: { title?: string; date?: string }) => void;
  /** 批量模式下禁用编辑 */
  disabled?: boolean;
}

export function TodoItem({ todo, onToggle, onDelete, onUpdate, disabled }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editDate, setEditDate] = useState(todo.date);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function startEdit() {
    if (disabled) return;
    setEditTitle(todo.title);
    setEditDate(todo.date);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  /** 保存（标题为空时还原，不产生空待办） */
  function saveEdit(nextTitle = editTitle, nextDate = editDate) {
    const title = nextTitle.trim();
    setEditing(false);
    if (!title) return;
    if (title !== todo.title || nextDate !== todo.date) {
      onUpdate(todo.id, { title, date: nextDate });
    }
  }

  // ─── 编辑态：内联输入框 + 日期快捷行 ───────────────────────────────────
  if (editing) {
    return (
      <div
        ref={containerRef}
        className="px-3 py-2.5 rounded-lg bg-white/60 border border-amber-300/50 space-y-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit();
            } else if (e.key === 'Escape') {
              cancelEdit();
            }
          }}
          onBlur={(e) => {
            // 焦点仍在编辑区内（如点了日期按钮）不触发保存
            if (containerRef.current?.contains(e.relatedTarget as Node)) return;
            saveEdit();
          }}
          className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <CalendarDays className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          {['今天', '明天', '后天'].map((label) => {
            const target = new Date();
            if (label === '明天') target.setDate(target.getDate() + 1);
            if (label === '后天') target.setDate(target.getDate() + 2);
            const targetStr = target.toISOString().slice(0, 10);
            const active = editDate === targetStr;
            return (
              <button
                key={label}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEditDate(targetStr);
                  saveEdit(editTitle, targetStr);
                }}
                className={`px-2 py-0.5 rounded-full text-xs border transition ${
                  active
                    ? 'bg-amber-400/80 border-amber-400 text-white'
                    : 'bg-white/50 border-white/60 text-[var(--text-secondary)] hover:border-amber-300'
                }`}
              >
                {label}
              </button>
            );
          })}
          <input
            type="date"
            value={editDate}
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (!e.target.value) return;
              setEditDate(e.target.value);
              saveEdit(editTitle, e.target.value);
            }}
            className="text-xs bg-white/50 border border-white/60 rounded-lg px-2 py-0.5 text-[var(--text-primary)] focus:outline-none focus:border-amber-300"
          />
        </div>
      </div>
    );
  }

  // ─── 展示态 ────────────────────────────────────────────────────────────
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/40 transition group"
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id)}
        className="flex-shrink-0 flex items-center justify-center"
      >
        {todo.isCompleted ? (
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-5 h-5 rounded-full bg-amber-400/70 flex items-center justify-center"
          >
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </motion.div>
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-amber-300/60" />
        )}
      </button>

      {/* Title：点击进入编辑 */}
      <button
        onClick={startEdit}
        disabled={disabled}
        className={`text-left flex-1 min-w-0 ${disabled ? 'cursor-default' : 'cursor-text'}`}
        title={disabled ? undefined : '点击编辑'}
      >
        <motion.span
          animate={{ opacity: todo.isCompleted ? 0.6 : 1, scale: todo.isCompleted ? 0.98 : 1 }}
          transition={{ duration: 0.2 }}
          className={
            todo.isCompleted
              ? 'text-[var(--text-secondary)] text-sm line-through opacity-60 block truncate'
              : 'text-[var(--text-primary)] text-sm block truncate'
          }
        >
          {todo.title}
        </motion.span>
      </button>

      {/* Delete button */}
      <button
        onClick={() => onDelete(todo.id)}
        className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-400 transition-opacity p-1"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
