/**
 * 飞书开放平台 API 封装（服务端使用）。
 *
 * 个人版/企业版自建应用：
 * - OAuth 授权码模式获取 user_access_token
 * - docx / drive / wiki 等 API 均以 user_access_token 作为凭证
 *
 * 参考文档：
 * - 授权：https://open.feishu.cn/document/common-capabilities/sso/api/obtain-oauth-code
 * - 获取 access_token：https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/authentication-management/access-token/authen-access_token/create
 * - drive files：https://open.feishu.cn/document/server-docs/docs/drive-v1/folder/list
 * - docx raw_content：https://open.feishu.cn/document/server-docs/docs/docs/docx-v1/document/raw_content
 */

const FEISHU_BASE = 'https://open.feishu.cn/open-apis';
const FEISHU_AUTHORIZE_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';

export interface FeishuTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
    scope: string;
  };
}

/**
 * 将飞书新旧两代响应归一化为 FeishuTokenResponse。
 * 2024+ 新版实际字段：`message` / `refresh_expires_in`，与旧文档 `msg` / `refresh_token_expires_in` 不一致。
 */
function normalizeTokenResponse(raw: unknown): FeishuTokenResponse {
  const r = (raw ?? {}) as {
    code?: number;
    msg?: string;
    message?: string;
    data?: {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
      refresh_expires_in?: number;
      scope?: string;
    };
  };
  const d = r.data;
  return {
    code: Number(r.code ?? -1),
    msg: r.msg ?? r.message ?? '',
    data: d
      ? {
          access_token: d.access_token ?? '',
          token_type: d.token_type ?? 'Bearer',
          expires_in: Number(d.expires_in ?? 0),
          refresh_token: d.refresh_token ?? '',
          refresh_token_expires_in: Number(
            d.refresh_token_expires_in ?? d.refresh_expires_in ?? 0
          ),
          scope: d.scope ?? '',
        }
      : undefined,
  };
}

export interface FeishuFile {
  token: string;
  name: string;
  type: string; // 'doc' | 'docx' | 'sheet' | 'bitable' | 'folder' | ...
  parent_token?: string;
  url?: string;
  modified_time?: string; // Unix seconds as string
  created_time?: string;
  owner_id?: string;
}

export interface FeishuListResponse {
  code: number;
  msg: string;
  data?: {
    files: FeishuFile[];
    next_page_token?: string;
    has_more: boolean;
  };
}

export interface FeishuRawContentResponse {
  code: number;
  msg: string;
  data?: {
    content: string;
  };
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量 ${name}`);
  return v;
}

export function buildAuthUrl(state: string): string {
  const appId = requireEnv('FEISHU_APP_ID');
  const redirect = requireEnv('FEISHU_REDIRECT_URI');
  const params = new URLSearchParams({
    app_id: appId,
    redirect_uri: redirect,
    response_type: 'code',
    state,
    // 飞书新权限命名（2024+）。与开放平台后台「权限管理」里已开启的权限保持一致，
    // 任一权限若未在后台开启，授权 URL 会被拒绝；未申请的权限 token 也不会包含。
    // 分组说明：
    //   基础身份：auth:user_access_token:read / contact:user.base:readonly
    //   云文档正文：docs:document.content:read / docx:document:readonly / docs:doc:readonly
    //   云空间：drive:drive:readonly（列文件，必需） / drive:drive.metadata:readonly
    //           / drive:drive.search:readonly / drive:file:readonly
    //           / space:document:retrieve（云文档清单）
    //   多维/表格/幻灯：bitable:app:readonly / sheets:spreadsheet:readonly / slides:presentation:read
    //   知识库：wiki:wiki:readonly / wiki:space:retrieve / wiki:node:retrieve / wiki:node:read
    scope: [
      'auth:user_access_token:read',
      'contact:user.base:readonly',
      'docs:document.content:read',
      'docs:doc:readonly',
      'docx:document:readonly',
      'drive:drive:readonly',
      'drive:drive.metadata:readonly',
      'drive:drive.search:readonly',
      'drive:file:readonly',
      'space:document:retrieve',
      'bitable:app:readonly',
      'sheets:spreadsheet:readonly',
      'slides:presentation:read',
      'wiki:wiki:readonly',
      'wiki:space:retrieve',
      'wiki:node:retrieve',
      'wiki:node:read',
    ].join(' '),
  });
  return `${FEISHU_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 获取 app_access_token（用于 OAuth 阶段）。
 */
async function getAppAccessToken(): Promise<string> {
  const appId = requireEnv('FEISHU_APP_ID');
  const appSecret = requireEnv('FEISHU_APP_SECRET');
  const res = await fetch(`${FEISHU_BASE}/auth/v3/app_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    cache: 'no-store',
  });
  const json = (await res.json()) as { code: number; msg: string; app_access_token?: string };
  if (json.code !== 0 || !json.app_access_token) {
    throw new Error(`飞书 app_access_token 获取失败: ${json.msg} (code=${json.code})`);
  }
  return json.app_access_token;
}

/**
 * code 换 user_access_token
 */
export async function exchangeCodeForToken(code: string): Promise<FeishuTokenResponse> {
  const appAccess = await getAppAccessToken();
  const res = await fetch(`${FEISHU_BASE}/authen/v1/oidc/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${appAccess}`,
    },
    body: JSON.stringify({ grant_type: 'authorization_code', code }),
    cache: 'no-store',
  });
  return normalizeTokenResponse(await res.json());
}

/**
 * refresh_token 续期
 */
export async function refreshUserToken(refreshToken: string): Promise<FeishuTokenResponse> {
  const appAccess = await getAppAccessToken();
  const res = await fetch(`${FEISHU_BASE}/authen/v1/oidc/refresh_access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Authorization: `Bearer ${appAccess}`,
    },
    body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    cache: 'no-store',
  });
  return normalizeTokenResponse(await res.json());
}

/**
 * 列出云空间文件（默认仅 root）。
 * type=docx 的条目可进一步拉取正文。
 */
export async function listDriveFiles(params: {
  userAccessToken: string;
  pageToken?: string;
  folderToken?: string;
  pageSize?: number;
}): Promise<FeishuListResponse> {
  const qs = new URLSearchParams();
  qs.set('page_size', String(params.pageSize ?? 50));
  if (params.pageToken) qs.set('page_token', params.pageToken);
  if (params.folderToken) qs.set('folder_token', params.folderToken);

  const res = await fetch(`${FEISHU_BASE}/drive/v1/files?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${params.userAccessToken}` },
    cache: 'no-store',
  });
  return (await res.json()) as FeishuListResponse;
}

/**
 * 获取 docx 文档纯文本内容。
 */
export async function getDocxRawContent(params: {
  userAccessToken: string;
  docToken: string;
}): Promise<FeishuRawContentResponse> {
  const res = await fetch(
    `${FEISHU_BASE}/docx/v1/documents/${encodeURIComponent(params.docToken)}/raw_content`,
    {
      headers: { Authorization: `Bearer ${params.userAccessToken}` },
      cache: 'no-store',
    }
  );
  return (await res.json()) as FeishuRawContentResponse;
}

// ─── 知识库 Wiki API ──────────────────────────────────────────────────────────
// 注：Wiki 节点树状结构与 Drive 路径状结构不同：
//   - space_id：知识空间 ID
//   - node_token：节点在树里的标识
//   - obj_token：节点背后实际文档 token（docx/sheet/bitable 等），调 raw_content/单元格等需用 obj_token
//   - obj_type：'doc' | 'docx' | 'sheet' | 'bitable' | 'slides' | 'mindnote' ...

export interface FeishuWikiSpace {
  space_id: string;
  name: string;
  description?: string;
  space_type?: string;
}

export interface FeishuWikiSpacesResponse {
  code: number;
  msg: string;
  data?: {
    items: FeishuWikiSpace[];
    page_token?: string;
    has_more: boolean;
  };
}

export interface FeishuWikiNode {
  node_token: string;
  obj_token: string;
  obj_type: string;
  title: string;
  parent_node_token?: string;
  has_child?: boolean;
  obj_create_time?: string;
  obj_edit_time?: string;
  origin_node_token?: string;
  origin_space_id?: string;
}

export interface FeishuWikiNodesResponse {
  code: number;
  msg: string;
  data?: {
    items: FeishuWikiNode[];
    page_token?: string;
    has_more: boolean;
  };
}

/** 列出当前用户可访问的所有知识空间。 */
export async function listWikiSpaces(params: {
  userAccessToken: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<FeishuWikiSpacesResponse> {
  const qs = new URLSearchParams();
  qs.set('page_size', String(params.pageSize ?? 50));
  if (params.pageToken) qs.set('page_token', params.pageToken);
  const res = await fetch(`${FEISHU_BASE}/wiki/v2/spaces?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${params.userAccessToken}` },
    cache: 'no-store',
  });
  return (await res.json()) as FeishuWikiSpacesResponse;
}

/**
 * 列出某知识空间某一层的节点。
 * 不填 parentNodeToken 则列出根层。
 */
export async function listWikiNodes(params: {
  userAccessToken: string;
  spaceId: string;
  parentNodeToken?: string;
  pageToken?: string;
  pageSize?: number;
}): Promise<FeishuWikiNodesResponse> {
  const qs = new URLSearchParams();
  qs.set('page_size', String(params.pageSize ?? 50));
  if (params.parentNodeToken) qs.set('parent_node_token', params.parentNodeToken);
  if (params.pageToken) qs.set('page_token', params.pageToken);
  const res = await fetch(
    `${FEISHU_BASE}/wiki/v2/spaces/${encodeURIComponent(params.spaceId)}/nodes?${qs.toString()}`,
    {
      headers: { Authorization: `Bearer ${params.userAccessToken}` },
      cache: 'no-store',
    }
  );
  return (await res.json()) as FeishuWikiNodesResponse;
}
