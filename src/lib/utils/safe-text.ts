/**
 * 防御性文本提取工具。
 * 从 IndexedDB 读取的数据可能残留 XML 解析对象（如 {#text, @_type}），
 * 在渲染或拼接前统一转为纯字符串。
 */
export function safeText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    // fast-xml-parser 可能将多 link 元素解析为数组，取第一个
    return safeText(value[0]);
  }
  if (value && typeof value === 'object' && '#text' in value) {
    return String((value as Record<string, unknown>)['#text']);
  }
  return String(value ?? '');
}
