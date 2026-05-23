export type Platform = 'wechat' | 'xiaohongshu' | 'zhihu' | 'juejin' | 'douyin' | 'other';

export interface PlatformInfo {
  platform: Platform;
  label: string;
  icon?: string; // lucide icon name
}

const PLATFORM_PATTERNS: { platform: Platform; patterns: RegExp[]; label: string }[] = [
  {
    platform: 'wechat',
    patterns: [/mp\.weixin\.qq\.com/, /weixin\.qq\.com/],
    label: '微信公众号',
  },
  {
    platform: 'xiaohongshu',
    patterns: [/xiaohongshu\.com/, /xhslink\.com/],
    label: '小红书',
  },
  {
    platform: 'zhihu',
    patterns: [/zhihu\.com/],
    label: '知乎',
  },
  {
    platform: 'juejin',
    patterns: [/juejin\.cn/],
    label: '掘金',
  },
  {
    platform: 'douyin',
    patterns: [/douyin\.com/, /dy\.ixigua\.com/],
    label: '抖音',
  },
];

export function detectPlatform(url: string): Platform {
  for (const { platform, patterns } of PLATFORM_PATTERNS) {
    if (patterns.some(p => p.test(url))) return platform;
  }
  return 'other';
}

export function isCreationUrl(url: string): boolean {
  return detectPlatform(url) !== 'other';
}

export function getPlatformLabel(platform: Platform): string {
  const found = PLATFORM_PATTERNS.find(p => p.platform === platform);
  return found?.label || '其他平台';
}

export function getAllPlatforms(): { platform: Platform; label: string }[] {
  return [
    ...PLATFORM_PATTERNS.map(p => ({ platform: p.platform, label: p.label })),
    { platform: 'other' as Platform, label: '其他平台' },
  ];
}
