import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('element-plus', () => ({
  ElMessage: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key) => key }),
  createI18n: () => ({ global: { t: (key) => key }, install: () => {} }),
}))

const stoppedWithoutModelStatus = {
  status: 'stopped',
  model: null,
  transport: 'uds',
  socketPath: '/tmp/mindvault.sock',
  core: {
    running: true,
    startedByNote: true,
    pid: 4242,
    defaultModel: {
      loaded: false,
      modelId: null,
      reason: '没有可自动加载的 ≤1B 本地模型',
    },
    telemetry: null,
  },
  port: null,
  ramMB: null,
  tokPerSec: null,
  lightweightPolicy: {
    maxParameterBillions: 1,
    description: 'MindVault Core 当前只加载 ≤1B 参数的本地量化模型',
  },
  error: null,
}

describe('AI renderer store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('explains when Core is online but no <=1B model is available', async () => {
    vi.stubGlobal('window', {
      ai: {
        getStatus: vi.fn(async () => stoppedWithoutModelStatus),
        importLocalModel: vi.fn(),
        onDownloadProgress: vi.fn(() => vi.fn()),
        onStatusChanged: vi.fn(() => vi.fn()),
      },
    })

    const { useAIStore } = await import('@/store/aiStore')
    const store = useAIStore()

    await store.fetchStatus()

    expect(store.coreRunning).toBe(true)
    expect(store.needsLightweightModel).toBe(true)
    expect(store.statusLabel).toBeTruthy()
    expect(store.statusDetail).toBe('没有可自动加载的 ≤1B 本地模型')
  })

  it('imports a local model and refreshes Core status', async () => {
    const getStatus = vi.fn(async () => stoppedWithoutModelStatus)
    const importLocalModel = vi.fn(async () => ({
      id: 'local-qwen',
      name: 'Local Qwen',
      parameterSize: '0.5B',
      quantization: 'Q4_K_M',
      sizeBytes: 1024,
      status: 'loaded',
      loadable: true,
      loadBlockReason: null,
    }))
    vi.stubGlobal('window', {
      ai: {
        getStatus,
        importLocalModel,
        onDownloadProgress: vi.fn(() => vi.fn()),
        onStatusChanged: vi.fn(() => vi.fn()),
      },
    })

    const { useAIStore } = await import('@/store/aiStore')
    const store = useAIStore()

    await store.importLocalModel()

    expect(importLocalModel).toHaveBeenCalled()
    expect(getStatus).toHaveBeenCalled()
  })

  it('includes recent Core inference telemetry in ready status details', async () => {
    vi.stubGlobal('window', {
      ai: {
        getStatus: vi.fn(async () => ({
          ...stoppedWithoutModelStatus,
          status: 'ready',
          model: {
            id: 'qwen-local',
            name: 'Qwen Local',
            path: '/models/qwen.gguf',
            sizeBytes: 1024,
            quantization: 'Q4_K_M',
            parameters: '0.5B',
          },
          tokPerSec: 80,
          core: {
            ...stoppedWithoutModelStatus.core,
            defaultModel: { loaded: true, modelId: 'qwen-local', reason: null },
            telemetry: {
              lastLatencyMs: 300,
              lastTokensPerSecond: 80,
              lastPromptTokens: 12,
              lastCompletionTokens: 24,
              lastTotalTokens: 36,
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        })),
        onDownloadProgress: vi.fn(() => vi.fn()),
        onStatusChanged: vi.fn(() => vi.fn()),
      },
    })

    const { useAIStore } = await import('@/store/aiStore')
    const store = useAIStore()

    await store.fetchStatus()

    expect(store.tokPerSec).toBe(80)
    // i18n mock returns keys; verify model and telemetry info in detail
    expect(store.statusDetail).toContain('Q4_K_M')
    expect(store.statusDetail).toContain('0.5B')
    expect(store.statusDetail).toContain('80')
  })
})
