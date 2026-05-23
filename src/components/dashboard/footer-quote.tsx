'use client';
import { useMemo } from 'react';

const quotes = [
  '万物皆有裂痕，那是光照进来的地方。 — 科恩',
  '完成比完美重要。',
  '不必等风来，你本身就是风。',
  '所有的路都是弯的，没有什么笔直的路。 — 卡尔维诺',
  '生活不是我们活过的日子，而是我们记住的日子。 — 马尔克斯',
  '把每一天都当作最后一天，终有一天你会如愿以偿。',
  '在你不曾注意的角落，种子已经发芽了。',
  '慢一点也没关系，重要的是没有停下。',
  '世界上只有一种英雄主义：看清生活后依然热爱。 — 罗曼·罗兰',
  '你不是迷路了，你只是在探索新的路径。',
  '每一次呼吸都是一次新的开始。',
  '时间是最好的作者，总会写出完美的结局。 — 卓别林',
  '心之所向，素履以往。',
  '日拱一卒，功不唐捐。',
  '所有伟大的事物都是缓慢生长的。',
];

export function FooterQuote() {
  const quote = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return quotes[dayOfYear % quotes.length];
  }, []);

  return (
    <div className="mt-2 pb-3">
      <div className="h-px bg-gradient-to-r from-transparent via-gray-200/30 to-transparent mb-2" />
      <p className="text-xs text-center text-gray-300 tracking-wide leading-relaxed">
        {quote}
      </p>
    </div>
  );
}
