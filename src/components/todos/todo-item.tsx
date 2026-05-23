'use client';

import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';

interface TodoItemProps {
  todo: { id: number; title: string; isCompleted: boolean; completedAt?: string };
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function TodoItem({ todo, onToggle, onDelete }: TodoItemProps) {
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

      {/* Title */}
      <motion.span
        animate={{ opacity: todo.isCompleted ? 0.6 : 1, scale: todo.isCompleted ? 0.98 : 1 }}
        transition={{ duration: 0.2 }}
        className={
          todo.isCompleted
            ? 'text-[var(--text-secondary)] text-sm line-through opacity-60 flex-1'
            : 'text-[var(--text-primary)] text-sm flex-1'
        }
      >
        {todo.title}
      </motion.span>

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
