'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ExpandableCardProps {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  accentColor?: string;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  children: ReactNode;
  className?: string;
}

export function ExpandableCard({
  id,
  title,
  subtitle,
  icon,
  accentColor = 'var(--accent)',
  isExpanded,
  onExpand,
  onCollapse,
  children,
  className = '',
}: ExpandableCardProps) {
  return (
    <>
      {/* 收起态卡片 */}
      {!isExpanded && (
        <motion.div
          layoutId={`card-${id}`}
          onClick={onExpand}
          className={`card-surface cursor-pointer p-5 ${className}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex items-start gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(77, 182, 160, 0.1)' }}
            >
              {icon}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-light tracking-wide" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h3>
              <p className="text-xs font-light mt-1" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* 展开态 - 全屏覆盖 */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={onCollapse}
            />
            
            {/* 展开的卡片 */}
            <motion.div
              layoutId={`card-${id}`}
              className="fixed inset-4 z-50 rounded-3xl p-6 overflow-y-auto backdrop-blur-xl"
              style={{
                background: 'rgba(240, 250, 248, 0.97)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.1)',
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            >
              {/* 顶部：标题 + 关闭按钮 */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(77, 182, 160, 0.1)' }}
                  >
                    {icon}
                  </div>
                  <h2 className="text-lg font-extralight tracking-wide" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h2>
                </div>
                <button
                  onClick={onCollapse}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.05)' }}
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
              
              {/* 模块内容 */}
              {children}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
