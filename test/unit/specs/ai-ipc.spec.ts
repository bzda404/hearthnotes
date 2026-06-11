import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }),
  },
}))

vi.mock('main_renderer/ai/coreBridge', () => ({
  initializeCoreBridge: vi.fn(async() => true),
  shutdownCoreBridge: vi.fn(),
  isCoreReady: vi.fn(() => true),
  getCoreRuntimeStatus: vi.fn(async() => ({
    running: true,
    transport: 'uds',
    socketPath: '/tmp/aincore.sock',
    loadedModel: 'qwen-local',
    status: 'ready',
  })),
  autocomplete: vi.fn(async(req: unknown) => ({
    completion: 'test completion',
    latencyMs: 10,
  })),
  correctGrammar: vi.fn(async(req: unknown) => ({
    corrected: 'corrected text',
    changes: [],
  })),
  summarize: vi.fn(async(req: unknown) => ({
    summary: 'summary text',
  })),
  suggestOrganization: vi.fn(async(req: unknown) => ({
    suggestions: [],
  })),
}))

describe('AI IPC handlers (Core Bridge)', () => {
  beforeEach(() => {
    handlers.clear()
  })

  it('registers status handler', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    expect(handlers.has('mt::ai::status')).toBe(true)
  })

  it('registers autocomplete handler', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    expect(handlers.has('mt::ai::autocomplete')).toBe(true)
  })

  it('registers grammar correction handler', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    expect(handlers.has('mt::ai::correct-grammar')).toBe(true)
  })

  it('registers summary handler', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    expect(handlers.has('mt::ai::summarize')).toBe(true)
  })

  it('registers organize handler', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    expect(handlers.has('mt::ai::organize')).toBe(true)
  })

  it('is-model-present returns true when Core ready', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    const handler = handlers.get('mt::ai::is-model-present')
    expect(handler).toBeDefined()
    const result = await handler!({ sender: {} }, {})
    expect(result).toBe(true)
  })

  it('AI status returns ready when Core connected', async() => {
    const { registerAIHandlers } = await import('main_renderer/ipc/ai')
    registerAIHandlers()
    const handler = handlers.get('mt::ai::status')
    expect(handler).toBeDefined()
    const result = await handler!({ sender: {} }) as Record<string, unknown>
    expect(result.status).toBe('ready')
    expect(result.transport).toBe('uds')
    expect(result.socketPath).toBe('/tmp/aincore.sock')
  })
})
