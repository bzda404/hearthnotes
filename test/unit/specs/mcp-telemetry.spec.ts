import path from 'path'
import os from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appendFile = vi.fn(async() => undefined)
const mkdir = vi.fn(async() => undefined)
const readFile = vi.fn(async() => '')

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => path.join(os.tmpdir(), 'aincore-user-data')),
  },
}))

vi.mock('fs/promises', () => ({
  appendFile,
  mkdir,
  readFile,
  default: {
    appendFile,
    mkdir,
    readFile,
  },
}))

describe('MCP telemetry persistence', () => {
  beforeEach(async() => {
    vi.resetModules()
    vi.clearAllMocks()
    const { resetMCPTelemetry } = await import('main_renderer/mcp/telemetry')
    resetMCPTelemetry()
  })

  it('persists privacy audit entries as JSONL without raw preview content', async() => {
    const { appendPrivacyAuditEntry } = await import('main_renderer/mcp/telemetry')

    appendPrivacyAuditEntry({
      requestId: 'req_1',
      tool: 'read_note',
      clientName: 'Claude Desktop',
      decision: 'desensitized',
      piiCount: 2,
      previewChars: 128,
      timestamp: '2026-01-01T00:00:00.000Z',
    })

    await vi.waitFor(() => expect(appendFile).toHaveBeenCalled())
    const userDataDir = path.join(os.tmpdir(), 'aincore-user-data')
    expect(mkdir).toHaveBeenCalledWith(userDataDir, { recursive: true })
    expect(appendFile).toHaveBeenCalledWith(
      path.join(userDataDir, 'mcp-audit-log.jsonl'),
      expect.stringContaining('"decision":"desensitized"'),
      'utf-8'
    )
    const appendCalls = appendFile.mock.calls as unknown[][]
    const persistedLine = appendCalls[0]?.[1] as string
    expect(persistedLine).not.toContain('alice@example.com')
  })

  it('loads the most recent privacy audit entries from disk', async() => {
    readFile.mockResolvedValueOnce([
      JSON.stringify({ requestId: 'old', tool: 'search_notes', clientName: 'Client', decision: 'allowed', piiCount: 0, previewChars: 30, timestamp: '2026-01-01T00:00:00.000Z' }),
      JSON.stringify({ requestId: 'new', tool: 'read_note', clientName: 'Claude Desktop', decision: 'rejected', piiCount: 1, previewChars: 80, timestamp: '2026-01-02T00:00:00.000Z' }),
      '',
    ].join('\n'))
    const { getMCPTelemetry, loadPrivacyAuditLog } = await import('main_renderer/mcp/telemetry')

    await loadPrivacyAuditLog()

    expect(getMCPTelemetry().privacy.auditLog[0].requestId).toBe('new')
    expect(getMCPTelemetry().privacy.auditLog[1].requestId).toBe('old')
  })
})
