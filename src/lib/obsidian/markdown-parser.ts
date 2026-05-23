/**
 * 极简 frontmatter 解析：避免新增 gray-matter 依赖。
 * 约定：frontmatter 必须位于文件最顶端，以 `---\n` 起止。
 * 仅支持字符串 / 字符串数组 / 标量三种最常见字段类型。
 */

export interface ParsedMarkdown {
  title?: string;
  tags?: string[];
  body: string;
  frontmatter: Record<string, unknown>;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseMarkdown(raw: string): ParsedMarkdown {
  const match = raw.match(FM_RE);
  if (!match) {
    return { body: raw, frontmatter: {} };
  }

  const fmText = match[1];
  const body = raw.slice(match[0].length);
  const fm: Record<string, unknown> = {};

  // 逐行解析 key: value
  const lines = fmText.split(/\r?\n/);
  let currentArrayKey: string | null = null;
  const arrays: Record<string, string[]> = {};

  for (const line of lines) {
    if (!line.trim()) {
      currentArrayKey = null;
      continue;
    }

    // 数组续行：`  - item`
    if (currentArrayKey && /^\s*-\s+/.test(line)) {
      const item = line.replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, '');
      arrays[currentArrayKey].push(item);
      continue;
    }

    const m = line.match(/^([A-Za-z0-9_\-]+):\s*(.*)$/);
    if (!m) {
      currentArrayKey = null;
      continue;
    }
    const key = m[1];
    const value = m[2].trim();

    if (!value) {
      // 可能是后续数组
      arrays[key] = [];
      currentArrayKey = key;
      continue;
    }

    // 内联数组 [a, b, c]
    if (/^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1).trim();
      if (!inner) {
        fm[key] = [];
      } else {
        fm[key] = inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
      }
      currentArrayKey = null;
      continue;
    }

    // 标量（去掉首尾引号）
    fm[key] = value.replace(/^['"]|['"]$/g, '');
    currentArrayKey = null;
  }

  for (const k of Object.keys(arrays)) {
    if (arrays[k].length > 0) {
      fm[k] = arrays[k];
    }
  }

  let title: string | undefined;
  if (typeof fm.title === 'string') title = fm.title;

  let tags: string[] | undefined;
  if (Array.isArray(fm.tags)) tags = fm.tags.filter((t): t is string => typeof t === 'string');
  else if (typeof fm.tags === 'string') tags = [fm.tags];

  return { title, tags, body, frontmatter: fm };
}

/**
 * 从正文第一段 markdown 标题提取 fallback title
 */
export function extractFallbackTitle(body: string): string | undefined {
  const m = body.match(/^\s*#\s+(.+)$/m);
  return m ? m[1].trim() : undefined;
}
