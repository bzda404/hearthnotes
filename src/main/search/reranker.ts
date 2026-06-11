/**
 * 1B 模型重排器
 * 利用常驻内存的 1B 模型进行低消耗语义重排
 *
 * 原理：构造 YES/NO 判断 Prompt，让常驻 MindVault Core 的本地模型
 * 只生成一个极短判断。不可用时回退到 BM25 分数。
 */
import { modelHubClient } from '../ai/modelHubClient'

interface RerankResult {
  docId: string
  path: string
  title: string
  score: number
  snippet: string
}

interface BM25Candidate {
  docId: string
  path: string
  title: string
  score: number
  snippet: string
}

export interface RerankTelemetry {
  attempted: number
  succeeded: number
  failed: number
  usedCore: boolean
}

let lastRerankTelemetry: RerankTelemetry = {
  attempted: 0,
  succeeded: 0,
  failed: 0,
  usedCore: false,
}

export function getLastRerankTelemetry(): RerankTelemetry {
  return { ...lastRerankTelemetry }
}

/**
 * 使用 1B 模型对 BM25 候选进行语义重排
 *
 * @param query 用户查询
 * @param candidates BM25 粗筛结果
 * @returns 重排后的结果（按语义相关性排序）
 */
export async function rerank(
  query: string,
  candidates: BM25Candidate[]
): Promise<RerankResult[]> {
  if (candidates.length === 0) return []

  // 限制重排数量（1B 模型处理太多会慢）
  const toRerank = candidates.slice(0, 10)
  let succeeded = 0
  let failed = 0

  const reranked: RerankResult[] = []

  for (const candidate of toRerank) {
    try {
      // 构造 YES/NO 判断 Prompt
      const prompt = `查询：${query.slice(0, 200)}
文档标题：${candidate.title}
文档内容：${candidate.snippet.slice(0, 300)}
该文档是否精确回答了查询？只回答 YES 或 NO。`

      const text = await modelHubClient.complete(prompt, {
        max_tokens: 1,
        temperature: 0,
      })
      succeeded++
      let semanticScore = candidate.score
      const answer = text.trim().toUpperCase()
      if (answer.startsWith('Y')) semanticScore = candidate.score * 2
      else if (answer.startsWith('N')) semanticScore = candidate.score * 0.3

      reranked.push({
        docId: candidate.docId,
        path: candidate.path,
        title: candidate.title,
        score: semanticScore,
        snippet: candidate.snippet,
      })
    } catch {
      failed++
      // 出错时保留 BM25 分数
      reranked.push({ ...candidate, score: candidate.score })
    }
  }

  lastRerankTelemetry = {
    attempted: toRerank.length,
    succeeded,
    failed,
    usedCore: succeeded > 0,
  }

  // 按语义分数降序排列
  return reranked.sort((a, b) => b.score - a.score)
}
