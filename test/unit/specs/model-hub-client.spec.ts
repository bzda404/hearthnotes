import { describe, expect, it, vi } from 'vitest'

const call = vi.fn()
const connect = vi.fn(async() => true)
const isConnected = vi.fn(() => true)

vi.mock('main_renderer/ai/udsClient', () => ({
  udsClient: {
    connect,
    isConnected,
    call,
  },
}))

describe('desktop ModelHubClient', () => {
  it('uses internal model methods for the built-in desktop client', async() => {
    const { ModelHubClient } = await import('main_renderer/ai/modelHubClient')
    call.mockResolvedValueOnce([])

    const client = new ModelHubClient()
    await client.listModels()

    expect(call).toHaveBeenCalledWith('internal.models.list')
  })

  it('uses internal inference methods for chat and completion', async() => {
    const { ModelHubClient } = await import('main_renderer/ai/modelHubClient')
    const client = new ModelHubClient()

    call.mockResolvedValueOnce({ choices: [{ message: { content: 'hello' } }] })
    await expect(client.chat({ messages: [{ role: 'user', content: 'hi' }] })).resolves.toBe('hello')
    expect(call).toHaveBeenLastCalledWith('internal.chat.completions', {
      messages: [{ role: 'user', content: 'hi' }],
    })

    call.mockResolvedValueOnce({ choices: [{ text: ' world' }] })
    await expect(client.complete('hello')).resolves.toBe(' world')
    expect(call).toHaveBeenLastCalledWith('internal.completions', { prompt: 'hello' })
  })

  it('uses the internal model registration method for downloaded local models', async() => {
    const { ModelHubClient } = await import('main_renderer/ai/modelHubClient')
    const client = new ModelHubClient()
    const params = {
      name: 'Qwen2.5-0.5B-Coder-Q4_K_M.gguf',
      quantization: 'Q4_K_M',
      filePath: '/models/qwen.gguf',
    }

    call.mockResolvedValueOnce({ model: { id: 'qwen' } })
    await client.registerLocalModel(params)

    expect(call).toHaveBeenLastCalledWith('internal.models.register', params)
  })
})
