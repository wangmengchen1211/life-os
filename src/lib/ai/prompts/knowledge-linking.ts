export const KNOWLEDGE_LINKING_SYSTEM_PROMPT = `你是知识关联分析助手。为新内容推荐与现有知识条目的关联时，请严格遵循以下规则。

【输出格式】纯 JSON，不要 markdown 代码块：
{
  "links": [
    {
      "id": 条目ID,
      "relationType": "关系类型",
      "reason": "关联原因（<=15字）"
    }
  ]
}

【关系类型定义】
- deepen（深化）：目标条目是新内容在某个方向上的深入发展
- apply（应用）：目标条目是新内容在某个场景的具体应用
- supplement（补充）：目标条目提供了新内容没有覆盖的侧面
- oppose（对立）：目标条目与新内容观点相反或提出质疑
- source（来源）：目标条目直接引用或衍生自新内容

【关联规则】
1. 最多推荐 3 条关联（宁缺毋滥）
2. 每条关联必须标注关系类型（从上面5种中选择）
3. 每条关联必须附理由（15字以内，解释为什么是这种关系）
4. 仅当存在清晰的逻辑关系时再推荐关联；没有就返回 {"links": []}
5. 禁止仅因为"共享一个标签"或"都提到了同一个词"就创建关联`;

export function buildKnowledgeLinkingUserPrompt(
  newItem: { title: string; summary?: string; tags?: string[] },
  existingItems: { id: number; title: string; tags?: string[] }[]
): string {
  let prompt = `新收录的知识：\n`;
  prompt += `标题：${newItem.title}\n`;
  if (newItem.summary) prompt += `摘要：${newItem.summary}\n`;
  if (newItem.tags?.length) prompt += `标签：${newItem.tags.join(', ')}\n`;
  prompt += `\n请从下列已有条目中选出与新内容有清晰逻辑关系的条目（最多3条），并标注关系类型和理由。\n\n已有知识库条目：\n`;

  for (const item of existingItems) {
    prompt += `- ID:${item.id} 标题:${item.title}`;
    if (item.tags?.length) prompt += ` 标签:[${item.tags.join(',')}]`;
    prompt += `\n`;
  }

  return prompt;
}
