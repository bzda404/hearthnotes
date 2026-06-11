import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const connect = vi.fn()
const isConnected = vi.fn()

vi.mock('main_renderer/ai/udsClient', () => ({
  udsClient: { connect, isConnected },
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  default: { spawn: vi.fn() },
}))

vi.mock('electron', () => ({
  app: { isPackaged: false },
}))

describe('MindVault Core supervisor', () => {
  beforeEach(() => {
    vi.resetModules()
    connect.mockReset()
    isConnected.mockReset()
    isConnected.mockReturnValue(false)
  })

  it('reuses an already running Core UDS server', async () => {
    connect.mockResolvedValueOnce(true)
    const { ensureCoreRunning } = await import('main_renderer/ai/coreSupervisor')
    await expect(ensureCoreRunning(10)).resolves.toBe(true)
  })

  it('returns false when Core is not running and no packaged binary found', async () => {
    connect.mockResolvedValue(false)
    const { ensureCoreRunning } = await import('main_renderer/ai/coreSupervisor')
    const result = await ensureCoreRunning(100)
    // In non-packaged dev mode with no packaged binary, should return false
    expect(result).toBe(false)
  })

  it('reports status correctly', async () => {
    isConnected.mockReturnValue(true)
    const { getCoreSupervisorStatus } = await import('main_renderer/ai/coreSupervisor')
    const status = getCoreSupervisorStatus()
    expect(status.running).toBe(true)
    expect(status.startedByNote).toBe(false)
    expect(status.pid).toBeNull()
  })
})
