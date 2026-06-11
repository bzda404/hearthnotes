import { IndexBuilder } from './indexBuilder'
import { federatedSearch } from './federatedSearch'

export const indexBuilder = new IndexBuilder()

export interface SearchResult {
  path: string
  title: string
  snippet: string
  score: number
  docId?: string
  sourceKB?: string
}

export async function buildKnowledgeBaseIndex(kbPath: string, kbName: string): Promise<void> {
  await indexBuilder.buildIndex(kbPath, kbName)
}

export async function searchKnowledgeBases(
  query: string,
  kbName?: string,
  topK: number = 20,
  useRerank: boolean = true
): Promise<SearchResult[]> {
  const indexes = indexBuilder.getIndexes()
  if (kbName) {
    const index = indexes.get(kbName)
    if (!index) return []
    const results = index.search(query, topK)
    if (!useRerank) return results
    const { rerank } = await import('./reranker')
    return rerank(query, results)
  }
  return federatedSearch(query, indexes, topK, useRerank)
}
