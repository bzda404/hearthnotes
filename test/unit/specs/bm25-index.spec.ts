/**
 * BM25 索引单元测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { BM25Index } from 'main_renderer/search/bm25Index'

describe('BM25Index', () => {
  let index: BM25Index

  beforeEach(() => {
    index = new BM25Index()
  })

  // ---- Core indexing ----
  it('should add documents and build inverted index', () => {
    index.addDocument('doc1', '/notes/a.md', 'Alpha', 'the quick brown fox')
    index.addDocument('doc2', '/notes/b.md', 'Beta', 'the lazy dog')

    // Search for content in doc1
    const results = index.search('brown fox', 10)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].title).toBe('Alpha')
  })

  it('should return empty for no match', () => {
    index.addDocument('doc1', '/notes/a.md', 'Alpha', 'hello world')
    const results = index.search('nonexistent', 10)
    expect(results.length).toBe(0)
  })

  it('should sort by BM25 score descending', () => {
    index.addDocument('doc1', '/notes/a.md', 'A', 'cat cat cat dog')
    index.addDocument('doc2', '/notes/b.md', 'B', 'cat dog bird')
    index.addDocument('doc3', '/notes/c.md', 'C', 'unrelated text here')

    const results = index.search('cat dog', 10)
    expect(results.length).toBeGreaterThanOrEqual(2)
    // doc1 should rank higher because "cat" appears more times
    expect(results[0].title).toBe('A')
  })

  // ---- Tokenization ----
  it('should tokenize English text', () => {
    index.addDocument('doc1', '/notes/a.md', 'Test', 'quick brown fox jumps over lazy dog')
    const results = index.search('brown fox', 5)
    expect(results.length).toBe(1)
  })

  it('should tokenize mixed Chinese-English text', () => {
    index.addDocument('doc1', '/notes/a.md', 'Test', '今天天气很好 hello world 今天下雨')
    // Bigram tokens: 今天, 天天, 天气, 气很, 很好 + unigrams
    const results = index.search('今天', 5)
    expect(results.length).toBe(1)
  })

  it('should handle empty content', () => {
    index.addDocument('doc1', '/notes/a.md', 'Empty', '')
    const results = index.search('anything', 5)
    expect(results.length).toBe(0)
  })

  // ---- Snippet ----
  it('should return relevant snippet', () => {
    index.addDocument('doc1', '/notes/a.md', 'Doc',
      'Lorem ipsum dolor sit amet. The important part is here. More text after.'
    )
    const results = index.search('important part', 5)
    expect(results.length).toBe(1)
    expect(results[0].snippet).toContain('important')
  })

  // ---- Chinese char-level fallback ----
  it('should handle Chinese characters with bigram fallback', () => {
    index.addDocument('doc1', '/notes/cn.md', '中文', '自然语言处理是人工智能的重要方向')
    const results = index.search('自然语言', 5)
    // 自然 + 然语 + 语言 should match
    expect(results.length).toBe(1)
  })

  // ---- Serialization ----
  it('should serialize and deserialize correctly', () => {
    index.addDocument('doc1', '/notes/a.md', 'Alpha', 'serialization test text here')
    index.addDocument('doc2', '/notes/b.md', 'Beta', 'second document for testing')

    const serialized = index.serialize()
    const restored = BM25Index.deserialize(serialized)

    const results = restored.search('serialization', 5)
    expect(results.length).toBe(1)
    expect(results[0].title).toBe('Alpha')
  })

  // ---- Top-K ----
  it('should respect topK parameter', () => {
    for (let i = 0; i < 10; i++) {
      index.addDocument(`doc${i}`, `/notes/${i}.md`, `Note${i}`, `test word ${i} extra content here`)
    }
    const results = index.search('test', 3)
    expect(results.length).toBe(3)
  })

  // ---- Remove ----
  it('should remove documents', () => {
    index.addDocument('doc1', '/notes/a.md', 'Keep', 'keep this document')
    index.addDocument('doc2', '/notes/b.md', 'Remove', 'remove this document')

    index.removeDocument('doc2')
    const results = index.search('remove', 5)
    // Should not find removed doc
    expect(results.every(r => r.docId !== 'doc2')).toBe(true)
  })

  // ---- Edge: many terms ----
  it('should handle queries with many terms', () => {
    index.addDocument('doc1', '/notes/a.md', 'Alpha', 'alpha beta gamma delta epsilon zeta')
    const results = index.search('alpha beta gamma delta epsilon', 5)
    expect(results.length).toBe(1)
  })

  // ---- Edge: duplicate words ----
  it('should not be confused by repeated query terms', () => {
    index.addDocument('doc1', '/notes/a.md', 'A', 'hello hello hello world')
    index.addDocument('doc2', '/notes/b.md', 'B', 'hello world world world')

    const results = index.search('hello', 5)
    // doc1 has 3x hello, doc2 has 1x hello
    expect(results[0].title).toBe('A')
  })
})
