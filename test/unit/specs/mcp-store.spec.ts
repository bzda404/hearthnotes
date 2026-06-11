import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

describe('MCP renderer store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('summarizes RAG and privacy sentinel telemetry for the UI', async() => {
    vi.stubGlobal('window', {
      mcp: {
        getStatus: vi.fn(async() => ({
          running: true,
          transport: 'stdio',
          port: null,
          connectedClients: 0,
          knowledgeBasePath: '/notes',
          telemetry: {
            rag: {
              lastQuery: 'security sentinel',
              lastHitCount: 3,
              lastRerankUsedCore: true,
              lastRerankAttempted: 3,
              lastRerankSucceeded: 3,
              lastRerankFailed: 0,
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
            privacy: {
              pendingCount: 0,
              lastTool: 'read_note',
              lastClientName: 'Claude Desktop',
              lastDecision: 'desensitized',
              auditLog: [{
                requestId: 'req_1',
                tool: 'read_note',
                clientName: 'Claude Desktop',
                decision: 'desensitized',
                piiCount: 2,
                previewChars: 128,
                timestamp: '2026-01-01T00:00:00.000Z',
              }],
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        })),
        onPrivacyPopup: vi.fn(() => vi.fn()),
        sendDecision: vi.fn(),
      },
    })

    const { useMCPStore } = await import('@/store/mcpStore')
    const store = useMCPStore()

    await store.fetchStatus()

    expect(store.ragLabel).toBe('3 命中 · Core 重排')
    expect(store.sentinelLabel).toBe('已脱敏放行')
    expect(store.recentAudit[0]).toMatchObject({
      tool: 'read_note',
      decision: 'desensitized',
      piiCount: 2,
    })
  })
})
