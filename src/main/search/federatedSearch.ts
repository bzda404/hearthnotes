/**
 * RRF（倒数排名融合）联邦检索
 *
 * 在不合并物理索引的前提下，动态构建跨知识库联邦视图
 *
 * RRF 公式: Score(d) += 1 / (k + rank(d))
 * k = 60（标准常数，平滑得分曲线）
 */

import { type BM25Index } from './bm25Index'
import { rerank } from './reranker'

interface FederatedResult {
  docId: string
  path: string
  title: string
  score: number
  snippet: string
  sourceKB: string
}

/**
 * 跨多个知识库（沙盒）执行联邦检索
 *
 * @param query 用户查询
 * @param indexes 各沙盒的 BM25 索引（key = 知识库名）
 * @param topK 返回结果数
 * @param useRerank 是否使用 1B 模型重排
 */
export async function federatedSearch(
  query: string,
  indexes: Map<string, BM25Index>,
  topK: number = 20,
  useRerank: boolean = false
): Promise<FederatedResult[]> {
  const RRF_K = 60
  const scores = new Map<string, { score: number; result: FederatedResult }>()

  // 并行查询所有沙盒
  const searchPromises = Array.from(indexes.entries()).map(async([kbName, index]) => {
    let results = index.search(query, topK)

    // 可选：使用 1B 模型重排
    if (useRerank && results.length > 0) {
      results = await rerank(query, results)
    }

    return { kbName, results }
  })

  const allResults = await Promise.all(searchPromises)

  // RRF 融合
  for (const { kbName, results } of allResults) {
    for (let rank = 0; rank < results.length; rank++) {
      const result = results[rank]
      const rrfScore = 1 / (RRF_K + rank + 1)

      const key = `${kbName}:${result.path}`
      if (scores.has(key)) {
        scores.get(key)!.score += rrfScore
      } else {
        scores.set(key, {
          score: rrfScore,
          result: {
            docId: result.docId,
            path: result.path,
            title: result.title,
            score: rrfScore,
            snippet: result.snippet,
            sourceKB: kbName,
          },
        })
      }
    }
  }

  // 按 RRF 分数降序排列，返回 Top-K
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.result)
}
