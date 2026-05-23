export type TimeTheme = 'morning' | 'afternoon' | 'evening';

export function getTimeTheme(): TimeTheme {
  // 手动覆盖优先
  if (typeof document !== 'undefined') {
    const override = document.documentElement.getAttribute('data-theme-override');
    if (override === 'light') return 'morning';
    if (override === 'dark') return 'evening';
  }
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  return 'evening';
}

export interface Greeting {
  main: string;
  sub: string;
}

export function getGreeting(): Greeting {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return { main: '清晨好', sub: '今天从哪一面镜子开始？' };
  if (hour >= 8 && hour < 12) return { main: '上午好', sub: '思路最清晰的时刻。' };
  if (hour >= 12 && hour < 17) return { main: '下午好', sub: '适合整理和回望。' };
  if (hour >= 17 && hour < 22) return { main: '晚上好', sub: '一天的褶皱可以摊开了。' };
  return { main: '夜深了', sub: '你的思考值得被月光接住。' };
}
