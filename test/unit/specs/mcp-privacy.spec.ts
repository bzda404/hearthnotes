import { mkdtemp, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearKnowledgeBasePath, setKnowledgeBasePath } from 'main_renderer/mcp/handlers'

interface SentPopup {
  request: { id: string; tool: string }
  preview: { masked: string }
}

const sentPopups = vi.hoisted(() => [] as SentPopup[])

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/mindvault-test'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => [{
      isDestroyed: () => false,
      webContents: {
        send: vi.fn((_channel: string, payload: unknown) => {
          sentPopups.push(payload as SentPopup)
        }),
      },
    }]),
  },
}))

describe('MCP privacy sentinel', () => {
  beforeEach(async() => {
    sentPopups.length = 0
    clearKnowledgeBasePath()
    const { resetMCPTelemetry } = await import('main_renderer/mcp/telemetry')
    resetMCPTelemetry()
    const { configurePrivacyInterceptor } = await import('main_renderer/mcp/privacyInterceptor')
    configurePrivacyInterceptor({
      enabled: true,
      timeoutSeconds: 5,
      autoRejectOnTimeout: true,
      desensitizeEnabled: true,
      allowedTools: [],
    })
  })

  it('shows a desensitized content preview before releasing read_note data', async() => {
    const root = await mkdtemp(join(tmpdir(), 'mindvault-privacy-'))
    const notePath = join(root, 'secret.md')
    await writeFile(notePath, '客户邮箱 alice@example.com，手机号 13812345678。', 'utf-8')
    setKnowledgeBasePath(root)

    const { callToolWithPrivacy } = await import('main_renderer/mcp/server')
    const { handleDecision } = await import('main_renderer/mcp/privacyInterceptor')
    const pending = callToolWithPrivacy('read_note', { path: notePath }, 'Claude Desktop')

    await vi.waitFor(() => expect(sentPopups).toHaveLength(1))
    const popup = sentPopups[0]
    expect(popup.request.tool).toBe('read_note')
    expect(popup.preview.masked).toContain('[EMAIL]')
    expect(popup.preview.masked).toContain('[PHONE]')
    expect(popup.preview.masked).not.toContain('alice@example.com')
    expect(popup.preview.masked).not.toContain('13812345678')

    handleDecision(popup.request.id, true, false)
    const result = await pending
    expect(result.isError).not.toBe(true)
    expect(result.content[0].text).toContain('alice@example.com')
  })

  it('returns masked tool output when the user chooses desensitized transfer', async() => {
    const root = await mkdtemp(join(tmpdir(), 'mindvault-privacy-'))
    const notePath = join(root, 'secret.md')
    await writeFile(notePath, '联系方式：alice@example.com / 13812345678', 'utf-8')
    setKnowledgeBasePath(root)

    const { callToolWithPrivacy } = await import('main_renderer/mcp/server')
    const { handleDecision } = await import('main_renderer/mcp/privacyInterceptor')
    const pending = callToolWithPrivacy('read_note', { path: notePath }, 'Claude Desktop')

    await vi.waitFor(() => expect(sentPopups).toHaveLength(1))
    const popup = sentPopups[0]
    handleDecision(popup.request.id, true, true)

    const result = await pending
    expect(result.isError).not.toBe(true)
    expect(result.content[0].text).toContain('[EMAIL]')
    expect(result.content[0].text).toContain('[PHONE]')
    expect(result.content[0].text).not.toContain('alice@example.com')
    const { getMCPTelemetry } = await import('main_renderer/mcp/telemetry')
    expect(getMCPTelemetry().privacy).toMatchObject({
      lastTool: 'read_note',
      lastClientName: 'Claude Desktop',
      lastDecision: 'desensitized',
      pendingCount: 0,
    })
    expect(getMCPTelemetry().privacy.auditLog[0]).toMatchObject({
      tool: 'read_note',
      clientName: 'Claude Desktop',
      decision: 'desensitized',
      piiCount: 2,
    })
  })

  it('rejects tool calls when the user denies the popup', async() => {
    const root = await mkdtemp(join(tmpdir(), 'mindvault-privacy-'))
    const notePath = join(root, 'secret.md')
    await writeFile(notePath, 'private', 'utf-8')
    setKnowledgeBasePath(root)

    const { callToolWithPrivacy } = await import('main_renderer/mcp/server')
    const { handleDecision } = await import('main_renderer/mcp/privacyInterceptor')
    const pending = callToolWithPrivacy('read_note', { path: notePath }, 'Claude Desktop')

    await vi.waitFor(() => expect(sentPopups).toHaveLength(1))
    handleDecision(sentPopups[0].request.id, false, false)

    const result = await pending
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Access denied')
    const { getMCPTelemetry } = await import('main_renderer/mcp/telemetry')
    expect(getMCPTelemetry().privacy.lastDecision).toBe('rejected')
    expect(getMCPTelemetry().privacy.auditLog[0].decision).toBe('rejected')
  })
})
