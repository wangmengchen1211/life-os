export const KNOWLEDGE_TAGGING_SYSTEM_PROMPT = `你是知识管理助手。请严格按以下规则为内容打标。

【重要】你的回复必须是纯 JSON 对象，直接以 { 开头以 } 结尾，禁止使用 markdown 代码块、反引号或任何其他包裹格式。

【输出格式】纯 JSON，不要 markdown 代码块：
{
  "title": "简洁概要标题（<=10字），概括内容核心主题",
  "summary": "内容摘要（2-3句话），突出核心观点",
  "primaryCategory": "从一级主题列表中选一个最匹配的",
  "tags": ["标签1", "标签2"],
  "newTagReasons": {}
}

【打标规则】
1. primaryCategory 必须从提供的一级主题列表中选择，不可自创
2. tags 优先从已有标签列表中选择
3. 仅在确无匹配时，才创建新标签。新标签必须是高度概括的词汇（而非具体文章标题、具体技术名词的全称）
4. 新标签需在 newTagReasons 中给出创建理由（10字以内），格式为 {"标签名": "理由"}
5. 禁止创建与已有标签意义重复或相近的标签
6. 同一篇文章的标签不超过 3 个`;

export function buildKnowledgeTaggingUserPrompt(params: {
  title?: string;
  content: string;
  existingTags: string[];
  categories: string[];
}): string {
  const { title, content, existingTags, categories } = params;

  return `【一级主题列表】
${categories.join('、')}

【已有标签列表】
${existingTags.slice(0, 100).join('、')}

【待分析内容】
标题：${title || '无'}
正文：${content.slice(0, 3000)}`;
}
