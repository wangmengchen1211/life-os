import { pgTable, text, integer, boolean, timestamp, jsonb, serial, real } from 'drizzle-orm/pg-core';

// 配置表 — 单行
export const userConfig = pgTable('user_config', {
  id: serial('id').primaryKey(),
  feishuTokenEncrypted: text('feishu_token_encrypted'),
  obsidianVaultPath: text('obsidian_vault_path'),
  aiBudgetLimitMonthly: real('ai_budget_limit_monthly').default(50),
  aiBudgetUsedMonthly: real('ai_budget_used_monthly').default(0),
  preferredAiProvider: text('preferred_ai_provider').default('deepseek'),
  themePreference: text('theme_preference').default('auto'),
  wechatRssUrls: text('wechat_rss_urls').array(),
  mediaLastSyncAt: timestamp('media_last_sync_at'),
  mediaLastSyncStatus: text('media_last_sync_status'),
});

// 错题本
export const errorQuestions = pgTable('error_questions', {
  id: serial('id').primaryKey(),
  subject: text('subject').notNull(),
  originalImageUrl: text('original_image_url'),
  questionText: text('question_text'),
  correctAnswer: text('correct_answer'),
  myAnswer: text('my_answer'),
  errorType: text('error_type'),
  knowledgeTags: text('knowledge_tags').array(),
  aiAnalysis: jsonb('ai_analysis'),
  annotations: jsonb('annotations'),  // JSONB array
  difficulty: integer('difficulty'),   // 1-5
  nextReviewAt: timestamp('next_review_at'),
  reviewCount: integer('review_count').default(0),
  masteredAt: timestamp('mastered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 知识库
// IndexedDB 扩展字段（v4）:
// - sourceCollection: 来源集名称
// - sourcePosition: 来源中的原始位置
// - primaryCategory: 一级主题分类
// IndexedDB 新增 topic-categories store（一级主题分类体系）
export const knowledgeItems = pgTable('knowledge_items', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // link/text/file/feishu/obsidian/creation_article
  title: text('title').notNull(),
  sourceUrl: text('source_url'),
  rawContent: text('raw_content'),
  aiSummary: text('ai_summary'),
  topicTags: text('topic_tags').array(),
  sourcePlatform: text('source_platform'),
  publishDate: timestamp('publish_date'),
  creationMetadata: jsonb('creation_metadata'), // nullable
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const knowledgeLinks = pgTable('knowledge_links', {
  id: serial('id').primaryKey(),
  itemAId: integer('item_a_id').references(() => knowledgeItems.id).notNull(),
  itemBId: integer('item_b_id').references(() => knowledgeItems.id).notNull(),
  relationType: text('relation_type'),
  aiReason: text('ai_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 日记库
export const diaryEntries = pgTable('diary_entries', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  moodTags: text('mood_tags').array(),
  keyThemes: text('key_themes').array(),
  aiFeedbackId: integer('ai_feedback_id'), // FK → reports
  wordCount: integer('word_count'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const diarySummaries = pgTable('diary_summaries', {
  id: serial('id').primaryKey(),
  periodType: text('period_type').notNull(), // week/month
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  summaryContent: text('summary_content'),
  emotionTrend: jsonb('emotion_trend'),
  keywordCloud: jsonb('keyword_cloud'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Todo
export const todos = pgTable('todos', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD format
  isCompleted: boolean('is_completed').default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 同步日志
export const syncLogs = pgTable('sync_logs', {
  id: serial('id').primaryKey(),
  platform: text('platform').notNull(),
  syncAt: timestamp('sync_at').defaultNow().notNull(),
  itemsAdded: integer('items_added').default(0),
  status: text('status').notNull(),
  errorMessage: text('error_message'),
});

// 报告
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // daily_digest/weekly_summary/monthly_letter/diary_feedback/error_analysis
  title: text('title').notNull(),
  content: jsonb('content'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
