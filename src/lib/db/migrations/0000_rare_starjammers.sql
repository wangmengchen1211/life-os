CREATE TABLE "diary_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"mood_tags" text[],
	"key_themes" text[],
	"ai_feedback_id" integer,
	"word_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"period_type" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"summary_content" text,
	"emotion_trend" jsonb,
	"keyword_cloud" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"original_image_url" text,
	"question_text" text,
	"correct_answer" text,
	"my_answer" text,
	"error_type" text,
	"knowledge_tags" text[],
	"ai_analysis" jsonb,
	"annotations" jsonb,
	"difficulty" integer,
	"next_review_at" timestamp,
	"review_count" integer DEFAULT 0,
	"mastered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text,
	"raw_content" text,
	"ai_summary" text,
	"topic_tags" text[],
	"source_platform" text,
	"publish_date" timestamp,
	"creation_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_a_id" integer NOT NULL,
	"item_b_id" integer NOT NULL,
	"relation_type" text,
	"ai_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"period_start" timestamp,
	"period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" text NOT NULL,
	"sync_at" timestamp DEFAULT now() NOT NULL,
	"items_added" integer DEFAULT 0,
	"status" text NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "todos" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" text NOT NULL,
	"is_completed" boolean DEFAULT false,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"feishu_token_encrypted" text,
	"obsidian_vault_path" text,
	"ai_budget_limit_monthly" real DEFAULT 50,
	"ai_budget_used_monthly" real DEFAULT 0,
	"preferred_ai_provider" text DEFAULT 'deepseek',
	"theme_preference" text DEFAULT 'auto',
	"wechat_rss_urls" text[],
	"media_last_sync_at" timestamp,
	"media_last_sync_status" text
);
--> statement-breakpoint
ALTER TABLE "knowledge_links" ADD CONSTRAINT "knowledge_links_item_a_id_knowledge_items_id_fk" FOREIGN KEY ("item_a_id") REFERENCES "public"."knowledge_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_links" ADD CONSTRAINT "knowledge_links_item_b_id_knowledge_items_id_fk" FOREIGN KEY ("item_b_id") REFERENCES "public"."knowledge_items"("id") ON DELETE no action ON UPDATE no action;