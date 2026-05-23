import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken } from '@/lib/feishu/client';

export const runtime = 'nodejs';

/**
 * 飞书 OAuth 回调：拿 code 换 token，通过 postMessage + localStorage 双通道把 token 回传给主窗口。
 * 双通道的原因：某些浏览器在跨源跳转回来后 window.opener 会被置 null，
 * 纯 postMessage 路径会丢失；localStorage 同源可以兜底。
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const feishuError = url.searchParams.get('error');

  if (feishuError) {
    return htmlResponse({ ok: false, error: feishuError, state }, `授权被拒绝：${feishuError}`);
  }
  if (!code) {
    return htmlResponse({ ok: false, error: 'missing_code', state }, '缺少授权码');
  }

  try {
    const resp = await exchangeCodeForToken(code);
    // 调试用：打印完整响应，方便沿着日志查真实字段结构
    console.log('[feishu oauth] token response:', JSON.stringify(resp));

    if (resp.code !== 0 || !resp.data) {
      return htmlResponse(
        { ok: false, error: resp.msg || 'exchange_failed', state },
        `换取 token 失败：${resp.msg || 'exchange_failed'}`
      );
    }

    // 飞书 2024+ 新版接口实际字段名与旧文档不一致：
    //   - refresh_token 过期时长: `refresh_expires_in`（非 `refresh_token_expires_in`）
    //   - 消息字段: `message`（非 `msg`）
    // 这里同时兼容两代命名，以及根层/`data.xxx` 两种位置。
    const rootLevel = resp as unknown as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
    };
    const data = resp.data as typeof resp.data & {
      refresh_expires_in?: number;
    };
    const accessToken = data.access_token ?? rootLevel.access_token;
    const refreshToken = data.refresh_token ?? rootLevel.refresh_token;
    const expiresIn = Number(data.expires_in ?? rootLevel.expires_in);
    const refreshExpiresIn = Number(
      data.refresh_token_expires_in ??
      data.refresh_expires_in ??
      rootLevel.refresh_token_expires_in ??
      rootLevel.refresh_expires_in
    );
    const scope = data.scope ?? rootLevel.scope ?? '';

    if (!accessToken || !refreshToken || !expiresIn || !refreshExpiresIn) {
      // 字段缺失：把原始响应截断后回显给用户，方便截图反馈
      const dump = JSON.stringify(resp).slice(0, 600);
      return htmlResponse(
        { ok: false, error: `token 字段异常: ${dump}`, state },
        `换取 token 返回字段异常，请截图反馈：${dump}`
      );
    }

    const now = Date.now();
    const payload = {
      accessToken,
      refreshToken,
      accessExpiresAt: new Date(now + expiresIn * 1000).toISOString(),
      refreshExpiresAt: new Date(now + refreshExpiresIn * 1000).toISOString(),
      scope,
    };
    return htmlResponse({ ok: true, payload, state }, '授权成功，窗口将自动关闭…');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal_error';
    return htmlResponse({ ok: false, error: message, state }, `授权失败：${message}`);
  }
}

function htmlResponse(message: Record<string, unknown>, tip: string) {
  const json = JSON.stringify({ type: 'feishu-oauth', ...message });
  const body = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<title>飞书授权</title>
<style>
  html,body{margin:0;padding:0;height:100%;background:#ffffff;color:#333;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
  .wrap{display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;}
  .card{max-width:320px;}
  .card p{margin:8px 0;}
  .tip{color:#888;font-size:12px;}
</style>
</head>
<body>
<div class="wrap"><div class="card">
<p>${escapeHtml(tip)}</p>
<p class="tip">如果窗口未自动关闭，请手动关闭；主窗口已收到结果。</p>
</div></div>
<script>
(function(){
  var msg = ${json};
  try { if (window.opener) { window.opener.postMessage(msg, '*'); } } catch(e){}
  try {
    var stored = Object.assign({}, msg, { ts: Date.now() });
    localStorage.setItem('__feishu_oauth_result', JSON.stringify(stored));
  } catch(e){}
  setTimeout(function(){ try { window.close(); } catch(e){} }, 400);
})();
</script>
</body></html>`;
  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>'"]/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c] ?? c;
  });
}
