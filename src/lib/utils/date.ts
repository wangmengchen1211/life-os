/**
 * 日期工具（日记补写/改期用）
 * - 本地时区语义：input[type=date] 的 YYYY-MM-DD ↔ ISO 字符串互转
 * - 统一取本地中午 12:00 转 ISO，避免 UTC 偏移导致日期跳变（±1 天）
 */

/** ISO → YYYY-MM-DD（本地时区） */
export function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → ISO（本地中午 12:00，规避时区偏移） */
export function dateInputToISO(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
