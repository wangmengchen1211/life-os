import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════════════════
// 链接正文解析（强化版）
// 策略：直连抓取 → 微信 #js_content / <article> / 段落密度启发式提取正文
//       直连失败或正文过短 → Jina Reader (r.jina.ai) 兜底
// ═══════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CONTENT_LENGTH = 8000;
const MIN_CONTENT_LENGTH = 200;

/** 去标签并压缩空白 */
function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(br|\/p|\/div|\/section|\/h[1-6]|\/li)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** 提取 <title> */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).trim() : '';
}

/** 微信公众号文章：精准提取 #js_content / .rich_media_content */
function extractWeChat(html: string): { text: string; title: string } | null {
  // 标题：og:title 更干净
  const ogTitle = html.match(/property="og:title"\s+content="([^"]*)"/i);
  // 正文容器
  const patterns = [
    /<div[^>]*id="js_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<script|<div[^>]*class="(?:rich_media_area_extra|ct_mpda_wrp)")/i,
    /<div[^>]*class="[^"]*rich_media_content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id="js_content"[^>]*>([\s\S]*)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const text = stripTags(m[1]);
      if (text.length >= MIN_CONTENT_LENGTH) {
        return { text, title: ogTitle ? ogTitle[1] : extractTitle(html) };
      }
    }
  }
  return null;
}

/** 通用页面：<article> 或段落密度启发式 */
function extractGeneric(html: string): string {
  // 优先 <article> 标签
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article) {
    const text = stripTags(article[1]);
    if (text.length >= MIN_CONTENT_LENGTH) return text;
  }

  // og:description / meta description 辅助
  // 段落密度启发式：收集所有 <p> / <section> 文本，取总长最长的组合
  const blocks: string[] = [];
  const blockRe = /<(p|section)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const t = stripTags(m[2]);
    if (t.length >= 20) blocks.push(t);
    if (blocks.length > 500) break;
  }
  const joined = blocks.join('\n');
  if (joined.length >= MIN_CONTENT_LENGTH) return joined;

  // 最后兜底：全页去标签
  return stripTags(html);
}

/** Jina Reader 兜底：返回 markdown 正文 */
async function fetchViaJina(url: string): Promise<{ title: string; content: string } | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const md = await res.text();
    if (!md || md.trim().length < MIN_CONTENT_LENGTH) return null;
    // Jina 输出格式：首行 "# 标题"，其余为正文
    const lines = md.split('\n');
    let title = '';
    if (lines[0]?.startsWith('# ')) {
      title = lines[0].slice(2).trim();
    }
    const content = (title ? lines.slice(1).join('\n') : md).trim();
    return { title, content };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return NextResponse.json({ error: '链接格式无效' }, { status: 400 });
  }

  let title = '';
  let content = '';

  try {
    // ── 第一通道：直连抓取 ──────────────────────────────────────────────
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };
      // 微信文章需要特殊 headers
      if (url.includes('mp.weixin.qq.com')) {
        headers['Referer'] = 'https://mp.weixin.qq.com/';
        headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
        headers['Accept-Language'] = 'zh-CN,zh;q=0.9,en;q=0.8';
      }

      const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
      if (response.ok) {
        const html = await response.text();
        if (url.includes('mp.weixin.qq.com')) {
          const wc = extractWeChat(html);
          if (wc) {
            content = wc.text;
            title = wc.title;
          }
        }
        if (!content) {
          title = title || extractTitle(html);
          content = extractGeneric(html);
        }
      }
    } catch {
      // 直连失败，落入兜底
    }

    // ── 第二通道：Jina Reader 兜底（直连失败或正文过短）──────────────────
    if (content.length < MIN_CONTENT_LENGTH) {
      const jina = await fetchViaJina(url);
      if (jina && jina.content.length > content.length) {
        content = jina.content;
        title = jina.title || title;
      }
    }

    if (!content) {
      return NextResponse.json({ error: '无法解析该链接内容' }, { status: 502 });
    }

    // 上限截断
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n...（内容已截断）';
    }

    return NextResponse.json({ title, content, url });
  } catch (error) {
    // 错误详情仅记录服务端日志，不外泄
    console.error('[knowledge/extract] error:', error);
    return NextResponse.json({ error: '链接解析失败，请稍后重试' }, { status: 502 });
  }
}
