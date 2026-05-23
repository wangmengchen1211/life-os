'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { TodoItem } from './todo-item';
import { Skeleton } from '@/components/ui/skeleton';
import {
  addTodo,
  getTodosByDate,
  toggleComplete,
  deleteTodo,
  type Todo,
} from '@/lib/storage/todo-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
  const today = toDateStr(new Date());
  const yesterday = toDateStr(new Date(Date.now() - 86400000));
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  if (dateStr === today) return '今天';
  if (dateStr === yesterday) return '昨天';
  if (dateStr === tomorrow) return '明天';
  const d = new Date(dateStr);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TodoList() {
  const [currentDate, setCurrentDate] = useState(() => toDateStr(new Date()));
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Batch mode state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const loadTodos = useCallback(async () => {
    setLoading(true);
    const items = await getTodosByDate(currentDate);
    setTodos(items);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // ─── Batch mode handlers ────────────────────────────────────────────────

  const enterBatchMode = () => {
    setBatchMode(true);
    setSelectedIds(new Set());
  };

  const exitBatchMode = () => {
    setBatchMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(todos.filter((t) => t.id != null).map((t) => t.id!));
    setSelectedIds(allIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const confirmed = window.confirm(`确认删除 ${selectedIds.size} 个待办事项？此操作不可撤销。`);
    if (!confirmed) return;

    setDeleting(true);
    try {
      for (const id of selectedIds) {
        await deleteTodo(id);
      }
      await loadTodos();
      exitBatchMode();
    } catch (e) {
      console.error('批量删除失败:', e);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Date navigation ─────────────────────────────────────────────────────

  function goToPreviousDay() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return toDateStr(d);
    });
  }

  function goToNextDay() {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return toDateStr(d);
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleAdd() {
    const title = inputValue.trim();
    if (!title) return;

    await addTodo({ title, date: currentDate });
    setInputValue('');
    await loadTodos();
  }

  async function handleToggle(id: number) {
    await toggleComplete(id);
    await loadTodos();
  }

  async function handleDelete(id: number) {
    await deleteTodo(id);
    await loadTodos();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  }

  // ─── Derived state ────────────────────────────────────────────────────────

  const pendingTodos = todos.filter((t) => !t.isCompleted);
  const completedTodos = todos.filter((t) => t.isCompleted);
  const isEmpty = todos.length === 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Date navigation */}
      <div className="flex items-center mb-4">
        <button
          onClick={goToPreviousDay}
          className="p-1.5 rounded-full hover:bg-white/50 text-[var(--text-secondary)] transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="flex-1 text-center text-sm font-medium text-[var(--text-primary)]">
          {formatDate(currentDate)}
        </span>
        <button
          onClick={goToNextDay}
          className="p-1.5 rounded-full hover:bg-white/50 text-[var(--text-secondary)] transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        {!batchMode && (
          <button
            onClick={enterBatchMode}
            className="ml-2 text-xs text-gray-400 hover:text-gray-500 transition-colors"
            title="批量管理"
          >
            批量
          </button>
        )}
      </div>

      {/* Quick add */}
      <div className="relative mb-4">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加一个待办..."
          className="w-full bg-white/40 border border-white/60 rounded-xl px-4 py-2.5 text-sm placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-amber-300/40 transition"
        />
        <button
          onClick={handleAdd}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[var(--text-secondary)] hover:text-amber-500 transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Todo list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-5/6" />
          </div>
        ) : isEmpty ? (
          <p className="text-center text-[var(--text-secondary)] text-sm py-12">
            今天没有待办，享受轻松的一天
          </p>
        ) : (
          <>
            {/* Pending todos */}
            <AnimatePresence mode="popLayout">
              {pendingTodos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-2">
                  {batchMode && (
                    <button
                      onClick={() => todo.id != null && toggleSelect(todo.id)}
                      className="shrink-0"
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
                        todo.id != null && selectedIds.has(todo.id)
                          ? 'bg-teal-500 border-teal-500'
                          : 'border-gray-300 bg-white/50'
                      }`}>
                        {todo.id != null && selectedIds.has(todo.id) && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  )}
                  <div className={`flex-1 ${
                    batchMode && todo.id != null && selectedIds.has(todo.id) ? 'ring-2 ring-teal-400/60 rounded-xl bg-teal-50/30' : ''
                  }`}>
                    <TodoItem
                      todo={{ id: todo.id!, title: todo.title, isCompleted: todo.isCompleted, completedAt: todo.completedAt }}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))}
            </AnimatePresence>

            {/* Completed section */}
            {completedTodos.length > 0 && (
              <>
                <div className="border-t border-white/40 mt-4 pt-3">
                  <span className="text-xs text-[var(--text-secondary)]">已完成</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {completedTodos.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2">
                      {batchMode && (
                        <button
                          onClick={() => todo.id != null && toggleSelect(todo.id)}
                          className="shrink-0"
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150 ${
                            todo.id != null && selectedIds.has(todo.id)
                              ? 'bg-teal-500 border-teal-500'
                              : 'border-gray-300 bg-white/50'
                          }`}>
                            {todo.id != null && selectedIds.has(todo.id) && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </button>
                      )}
                      <div className={`flex-1 ${
                        batchMode && todo.id != null && selectedIds.has(todo.id) ? 'ring-2 ring-teal-400/60 rounded-xl bg-teal-50/30' : ''
                      }`}>
                        <TodoItem
                          todo={{ id: todo.id!, title: todo.title, isCompleted: todo.isCompleted, completedAt: todo.completedAt }}
                          onToggle={handleToggle}
                          onDelete={handleDelete}
                        />
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </>
        )}
      </div>

      {/* Floating add button */}
      {!batchMode && (
        <button
          onClick={() => inputRef.current?.focus()}
          className="absolute bottom-4 right-4 bg-amber-400/80 hover:bg-amber-400 text-white rounded-full w-11 h-11 shadow-lg flex items-center justify-center transition"
          aria-label="添加待办"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}

      {/* Batch Mode Bottom Bar */}
      {batchMode && (
        <div className="sticky bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 mt-2 bg-white/90 backdrop-blur-sm rounded-t-xl shadow-[0_-2px_8px_rgba(0,0,0,0.06)] border-t border-teal-100/60">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            已选 <span className="text-teal-600 font-semibold">{selectedIds.size}</span>
          </span>
          <button
            onClick={selectedIds.size === todos.length && todos.length > 0 ? deselectAll : selectAll}
            className="px-1.5 py-0.5 text-xs rounded-md bg-black/5 text-gray-600 hover:bg-black/10 transition-colors whitespace-nowrap"
          >
            {selectedIds.size === todos.length && todos.length > 0 ? '反选' : '全选'}
          </button>
          <button
            onClick={handleBatchDelete}
            disabled={selectedIds.size === 0 || deleting}
            className="px-1.5 py-0.5 text-xs rounded-md bg-red-50 text-red-500 hover:bg-red-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 whitespace-nowrap"
          >
            <Trash2 size={11} />
            {deleting ? '删除...' : '删除'}
          </button>
          <button
            onClick={exitBatchMode}
            className="ml-auto p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors"
            title="退出批量模式"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
