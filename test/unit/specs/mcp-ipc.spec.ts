import path from 'path'
import os from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearKnowledgeBasePath, getKnowledgeBasePath } from 'main_renderer/mcp/handlers'

const handlers = new Map<string, (...args: unknown[]) => unknown>()

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'aincore-test')),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    }),
  },
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(async() => ''),
  appendFile: vi.fn(async() => undefined),
  mkdir: vi.fn(async() => undefined),
  default: {
    readFile: vi.fn(async() => ''),
    appendFile: vi.fn(async() => undefined),
    mkdir: vi.fn(async() => undefined),
  },
}))

describe('MCP IPC handlers', () => {
  beforeEach(() => {
    handlers.clear()
    clearKnowledgeBasePath()
  })

  it('sets the active knowledge base path and exposes it in status', async() => {
    const { registerMCPHandlers } = await import('main_renderer/ipc/mcp')
    registerMCPHandlers()

    const kbPath = path.join(os.tmpdir(), 'aincore-notes')
    await handlers.get('mt::mcp::set-knowledge-base')?.({}, kbPath)
    const status = await handlers.get('mt::mcp::status')?.({})

    expect(getKnowledgeBasePath()).toBe(kbPath)
    expect(status).toMatchObject({
      running: true,
      transport: 'stdio',
      port: null,
      connectedClients: 0,
      knowledgeBasePath: kbPath,
      telemetry: {
        rag: {
          lastHitCount: 0,
          lastRerankUsedCore: false,
        },
        privacy: {
          pendingCount: 0,
          lastDecision: null,
          auditLog: [],
        },
      },
    })
  })
})
