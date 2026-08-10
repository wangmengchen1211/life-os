'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 统一的 Markdown 富文本渲染组件
 * - 用于 AI 输出（镜像洞见、未来回音等）的视觉美化
 * - 流式输出时也能安全渲染未完成的 markdown
 */
export function RichText({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`text-[15px] leading-[1.9] text-[var(--text-primary)] ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // ─── 标题层级 ────────────────────────────────────────────────────
          h1: ({ children }) => (
            <h1 className="text-lg font-bold mt-3 mb-1.5 pb-1 border-b border-black/5 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold mt-3 mb-1.5 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold mt-2.5 mb-1 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[15px] font-semibold mt-2 mb-1 first:mt-0">{children}</h4>
          ),
          // ─── 段落 ────────────────────────────────────────────────────────
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          // ─── 列表 ────────────────────────────────────────────────────────
          ul: ({ children }) => (
            <ul className="my-1.5 pl-4 space-y-0.5 list-disc marker:text-purple-400/70">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1.5 pl-4 space-y-0.5 list-decimal marker:text-purple-400/70">{children}</ol>
          ),
          li: ({ children }) => <li className="pl-0.5">{children}</li>,
          // ─── 强调 ────────────────────────────────────────────────────────
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // ─── 行内代码 / 代码块 ────────────────────────────────────────────
          code: ({ className: cls, children }) => {
            const isBlock = cls?.includes('language-') || String(children).includes('\n');
            if (isBlock) {
              return (
                <code className="block bg-[#1e1b2e] text-purple-100 rounded-lg px-3 py-2.5 my-2 text-[13px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-purple-50 border border-purple-100/60 text-purple-700 rounded-md px-1.5 py-0.5 text-[13px] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          // ─── 引用 ────────────────────────────────────────────────────────
          blockquote: ({ children }) => (
            <blockquote className="my-2 pl-3 border-l-[3px] border-purple-200 bg-purple-50/40 rounded-r-lg py-1.5 pr-2 text-purple-900/80 italic">
              {children}
            </blockquote>
          ),
          // ─── 表格 ────────────────────────────────────────────────────────
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-lg border border-black/5">
              <table className="w-full text-[13px] border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50/80">{children}</thead>,
          th: ({ children }) => (
            <th className="px-2.5 py-1.5 text-left font-medium text-gray-600 border-b border-black/5 whitespace-nowrap">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2.5 py-1.5 border-b border-black/5 align-top">{children}</td>
          ),
          // ─── 链接 ────────────────────────────────────────────────────────
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 underline decoration-purple-300 underline-offset-2 break-all"
            >
              {children}
            </a>
          ),
          // ─── 分隔线 ──────────────────────────────────────────────────────
          hr: () => <hr className="my-3 border-black/5" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
