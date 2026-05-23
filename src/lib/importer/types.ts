/**
 * 公共导入内核类型定义。
 *
 * 所有外部源导入（Obsidian / 飞书 / …）都走统一的进度 & 结果结构。
 */

export type ImportSource = 'obsidian' | 'feishu';

export type ImportAction = 'inserted' | 'updated' | 'skipped' | 'failed';

export interface ImportProgress {
  /** 已处理文件数 */
  processed: number;
  /** 本次扫描到的文件总数（0 表示未知，边扫边传时可能为 0） */
  total: number;
  /** 当前正在处理的文件路径或标题 */
  current?: string;
  /** 当前文件的处理结果 */
  action?: ImportAction;
  /** 阶段文字（"扫描中"/"写入中"/"完成"） */
  stage?: string;
}

export interface ImportSummary {
  source: ImportSource;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  total: number;
  errors: Array<{ file: string; message: string }>;
  startedAt: string;
  finishedAt: string;
}

export type ProgressHandler = (p: ImportProgress) => void;
