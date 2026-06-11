import { describe, expect, it, vi } from 'vitest'
import { rerank } from 'main_renderer/search/reranker'

const { complete } = vi.hoisted(() => ({
  complete: vi.fn(),
}))

vi.mock('main_renderer/ai/modelHubClient', () => ({
  modelHubClient: {
    complete,
  },
}))

describe('rerank', () => {
  it('uses the local Model Hub completion result to rescore BM25 candidates', async() => {
    complete
      .mockResolvedValueOnce('NO')
      .mockResolvedValueOnce('YES')

    const results = await rerank('local model', [
      { docId: 'a', path: '/a.md', title: 'A', score: 10, snippet: 'unrelated' },
      { docId: 'b', path: '/b.md', title: 'B', score: 6, snippet: 'local model details' },
    ])

    expect(complete).toHaveBeenCalledTimes(2)
    expect(results[0].docId).toBe('b')
    expect(results[0].score).toBe(12)
    expect(results[1].score).toBe(3)
  })

  it('falls back to BM25 score when Model Hub completion fails', async() => {
    complete.mockRejectedValueOnce(new Error('offline'))

    const results = await rerank('query', [
      { docId: 'a', path: '/a.md', title: 'A', score: 2, snippet: 'text' },
    ])

    expect(results[0].score).toBe(2)
  })
})
