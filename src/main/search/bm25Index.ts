/**
 * BM25 稀疏检索索引
 * 参数: k1=1.2, b=0.75（标准值）
 *
 * BM25 公式:
 * score(D, Q) = Σ IDF(qi) · (f(qi, D) · (k1 + 1)) / (f(qi, D) + k1 · (1 - b + b · |D|/avgdl))
 *
 * 其中:
 * - f(qi, D) = 词 qi 在文档 D 中的词频
 * - |D| = 文档 D 的长度（token 数）
 * - avgdl = 语料库平均文档长度
 * - IDF(qi) = log((N - n(qi) + 0.5) / (n(qi) + 0.5) + 1)
 * - N = 语料库中文档总数
 * - n(qi) = 包含词 qi 的文档数
 */

interface BM25Document {
  id: string
  path: string
  title: string
  tokens: string[]
  length: number
}

interface BM25Result {
  docId: string
  path: string
  title: string
  score: number
  snippet: string
}

interface InvertedEntry {
  docId: string
  tf: number // term frequency
}

export class BM25Index {
  private k1 = 1.2
  private b = 0.75
  private documents: Map<string, BM25Document> = new Map()
  private invertedIndex: Map<string, InvertedEntry[]> = new Map()
  private totalDocs = 0
  private avgDocLength = 0
  private docLengths: number[] = []

  /**
   * 添加文档到索引
   */
  addDocument(id: string, path: string, title: string, content: string): void {
    const tokens = this.tokenize(content)
    const doc: BM25Document = { id, path, title, tokens, length: tokens.length }
    this.documents.set(id, doc)
    this.docLengths.push(tokens.length)

    // 更新倒排索引
    const tfMap = new Map<string, number>()
    for (const token of tokens) {
      tfMap.set(token, (tfMap.get(token) || 0) + 1)
    }
    for (const [token, tf] of tfMap) {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, [])
      }
      this.invertedIndex.get(token)!.push({ docId: id, tf })
    }

    // 更新统计
    this.totalDocs = this.documents.size
    this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / this.totalDocs
  }

  /**
   * 移除文档
   */
  removeDocument(id: string): void {
    this.documents.delete(id)
    // 重建倒排索引（简单实现）
    this.rebuildIndex()
  }

  /**
   * 搜索
   */
  search(query: string, topK: number = 20): BM25Result[] {
    const queryTokens = this.tokenize(query)
    const scores = new Map<string, number>()

    for (const token of queryTokens) {
      const entries = this.invertedIndex.get(token) || []
      const nqi = entries.length
      if (nqi === 0) continue

      const idf = Math.log((this.totalDocs - nqi + 0.5) / (nqi + 0.5) + 1)

      for (const entry of entries) {
        const doc = this.documents.get(entry.docId)
        if (!doc) continue

        const tf = entry.tf
        const dl = doc.length
        const tfNorm =
          (tf * (this.k1 + 1)) /
          (tf + this.k1 * (1 - this.b + (this.b * dl) / this.avgDocLength))
        const score = idf * tfNorm

        scores.set(entry.docId, (scores.get(entry.docId) || 0) + score)
      }
    }

    // 排序并返回 Top-K
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([docId, score]) => {
        const doc = this.documents.get(docId)!
        return {
          docId,
          path: doc.path,
          title: doc.title,
          score,
          snippet: this.extractSnippet(doc.tokens, queryTokens),
        }
      })
  }

  /**
   * 分词器 — 中英文混合分词
   * 使用 jieba-wasm 进行中文分词，fallback 到逐字+bigram
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = []
    const cleaned = text.toLowerCase().replace(/[^\w一-鿿]/g, ' ')

    // Try jieba-wasm for proper Chinese word segmentation
    // Falls back to character-level + bigram if jieba is not loaded
    if (typeof this.segmentChinese === 'function') {
      const segmented = this.segmentChinese(text)
      tokens.push(...segmented.filter((t: string) => t.length > 0))
    } else {
      // Fallback: character-level + bigram
      const parts = cleaned.split(/\s+/).filter(Boolean)
      for (const part of parts) {
        if (/^[a-z0-9]+$/.test(part)) {
          if (part.length > 1) tokens.push(part)
        } else {
          const chars = part.split('').filter((c) => /[一-鿿]/.test(c))
          // Unigram
          for (const char of chars) {
            tokens.push(char)
          }
          // Bigram
          for (let i = 0; i < chars.length - 1; i++) {
            tokens.push(chars[i] + chars[i + 1])
          }
        }
      }
    }

    return tokens
  }

  /**
   * Optional external segmenter — set by indexBuilder or consumers.
   */
  segmentChinese: ((text: string) => string[]) | null = null

  /**
   * 提取匹配片段
   */
  private extractSnippet(tokens: string[], queryTokens: string[]): string {
    const querySet = new Set(queryTokens)
    let bestStart = 0
    let bestScore = 0
    for (let i = 0; i < tokens.length; i++) {
      let score = 0
      for (let j = i; j < Math.min(i + 30, tokens.length); j++) {
        if (querySet.has(tokens[j])) score++
      }
      if (score > bestScore) {
        bestScore = score
        bestStart = i
      }
    }
    return tokens.slice(bestStart, bestStart + 50).join('')
  }

  /**
   * 重建倒排索引
   */
  private rebuildIndex(): void {
    this.invertedIndex.clear()
    this.docLengths = []
    const docs = Array.from(this.documents.values())
    this.documents.clear()
    for (const doc of docs) {
      this.addDocument(doc.id, doc.path, doc.title, doc.tokens.join(' '))
    }
  }

  /**
   * 序列化索引（用于持久化）
   */
  serialize(): string {
    return JSON.stringify({
      documents: Array.from(this.documents.entries()),
      invertedIndex: Array.from(this.invertedIndex.entries()),
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
      docLengths: this.docLengths,
    })
  }

  /**
   * 反序列化索引
   */
  static deserialize(data: string): BM25Index {
    const parsed = JSON.parse(data)
    const index = new BM25Index()
    index.documents = new Map(parsed.documents)
    index.invertedIndex = new Map(parsed.invertedIndex)
    index.totalDocs = parsed.totalDocs
    index.avgDocLength = parsed.avgDocLength
    index.docLengths = parsed.docLengths
    return index
  }
}
