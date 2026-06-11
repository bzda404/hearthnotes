import { describe, expect, it, vi } from 'vitest'

const autocompleteBridge = vi.fn()

vi.mock('main_renderer/ai/coreBridge', () => ({
  autocomplete: autocompleteBridge,
}))

describe('AI service autocomplete', () => {
  it('sanitizes local model completion output before returning ghost text', async () => {
    autocompleteBridge.mockResolvedValueOnce({
      completion: 'next stable words',
      latencyMs: 42,
    })

    const { autocomplete } = await import('main_renderer/ai/aiService')

    const result = await autocomplete({
      context: 'local context',
      cursorPosition: 'local context'.length,
    })

    expect(autocompleteBridge).toHaveBeenCalledWith({
      context: 'local context',
      cursorPosition: 'local context'.length,
    })
    expect(result.completion).toBe('next stable words')
    expect(result.latencyMs).toBe(42)
  })
})
