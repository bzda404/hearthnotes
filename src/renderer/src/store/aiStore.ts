/**
 * AI Pinia store — manages AI sidecar state in the renderer.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import type {
  AISidecarStatus,
  AutocompleteRequest,
  AutocompleteResponse,
  GrammarCorrectionRequest,
  GrammarCorrectionResponse,
  SummarizeRequest,
  SummarizeResponse,
  OrganizeRequest,
  OrganizeResponse,
  ChatWithContextRequest,
  ChatWithContextResponse,
  ModelDownloadProgress,
  SidecarStatus,
} from '@shared/types/aiTypes'

export const useAIStore = defineStore('ai', () => {
  const { t } = useI18n()

  // ---- State ----
  const status = ref<SidecarStatus>('stopped')
  const model = ref<AISidecarStatus['model']>(null)
  const port = ref<number | null>(null)
  const ramMB = ref<number | null>(null)
  const tokPerSec = ref<number | null>(null)
  const core = ref<AISidecarStatus['core'] | null>(null)
  const error = ref<string | null>(null)
  const isDownloading = ref(false)
  const downloadProgress = ref<ModelDownloadProgress | null>(null)
  const autocompleteEnabled = ref(true)
  const grammarEnabled = ref(true)
  const summarizeEnabled = ref(true)
  const organizeEnabled = ref(true)

  // ---- Reconnection state ----
  const isReconnecting = ref(false)
  const reconnectAttempt = ref(0)

  // ---- Getters ----
  const isReady = computed(() => status.value === 'ready')
  const isStarting = computed(() => status.value === 'starting')
  const hasModel = computed(() => !!model.value)
  const coreRunning = computed(() => core.value?.running === true)
  const needsLightweightModel = computed(() => coreRunning.value && !model.value && core.value?.defaultModel?.loaded === false)
  const statusLabel = computed(() => {
    if (isReconnecting.value) {
      return t('ai.status.reconnecting', { attempt: reconnectAttempt.value })
    }
    if (status.value === 'stopped' && coreRunning.value) {
      return needsLightweightModel.value
        ? t('ai.status.onlineNeedsModel')
        : t('ai.status.onlineWaiting')
    }
    switch (status.value) {
      case 'stopped': return t('ai.status.offline')
      case 'starting': return t('ai.status.starting')
      case 'ready': return model.value
        ? t('ai.status.readyWithModel', { name: model.value.name })
        : t('ai.status.ready')
      case 'error': return t('ai.status.error')
      default: return t('ai.status.unknown')
    }
  })
  const statusDetail = computed(() => {
    if (error.value) return error.value
    if (needsLightweightModel.value) {
      return core.value?.defaultModel?.reason || t('ai.detail.needLightweight')
    }
    if (coreRunning.value && !model.value) return t('ai.detail.connectedNoModel')
    if (model.value) {
      const telemetry = core.value?.telemetry
      const perf = telemetry?.lastLatencyMs
        ? ` · ${t('ai.detail.latency', { ms: telemetry.lastLatencyMs })}${telemetry.lastTokensPerSecond ? ` · ${telemetry.lastTokensPerSecond} ${t('ai.detail.tokPerSec')}` : ''}`
        : ''
      return `${model.value.quantization} · ${model.value.parameters || t('ai.detail.unknownParams')}${perf}`
    }
    return t('ai.detail.defaultHint')
  })

  // ---- Actions ----

  async function fetchStatus(): Promise<void> {
    try {
      const s = await window.ai.getStatus()
      status.value = s.status
      model.value = s.model
      port.value = s.port
      ramMB.value = s.ramMB
      tokPerSec.value = s.tokPerSec
      core.value = s.core
      error.value = s.error
    } catch (err) {
      status.value = 'error'
      error.value = String(err)
    }
  }

  async function autocomplete(req: AutocompleteRequest): Promise<AutocompleteResponse> {
    if (!isReady.value) {
      ElMessage.warning(t('error.AI_NOT_READY'))
      throw new Error('AI is not ready')
    }
    return window.ai.autocomplete(req)
  }

  async function correctGrammar(req: GrammarCorrectionRequest): Promise<GrammarCorrectionResponse> {
    if (!isReady.value) {
      ElMessage.warning(t('error.AI_NOT_READY'))
      throw new Error('AI is not ready')
    }
    return window.ai.correctGrammar(req)
  }

  async function summarize(req: SummarizeRequest): Promise<SummarizeResponse> {
    if (!isReady.value) {
      ElMessage.warning(t('error.AI_NOT_READY'))
      throw new Error('AI is not ready')
    }
    return window.ai.summarize(req)
  }

  async function chatWithContext(req: ChatWithContextRequest): Promise<ChatWithContextResponse> {
    if (!isReady.value) {
      ElMessage.warning(t('error.AI_NOT_READY'))
      throw new Error('AI is not ready')
    }
    return window.ai.chatWithContext(req)
  }

  async function organize(req: OrganizeRequest): Promise<OrganizeResponse> {
    if (!isReady.value) {
      ElMessage.warning(t('error.AI_NOT_READY'))
      throw new Error('AI is not ready')
    }
    return window.ai.organize(req)
  }

  async function downloadModel(): Promise<void> {
    if (isDownloading.value) return
    isDownloading.value = true
    downloadProgress.value = null

    try {
      await window.ai.downloadModel()
    } finally {
      isDownloading.value = false
      downloadProgress.value = null
    }
  }

  async function importLocalModel(): Promise<void> {
    await window.ai.importLocalModel()
    await fetchStatus()
  }

  function cancelDownload(): void {
    window.ai.cancelDownload()
    isDownloading.value = false
    downloadProgress.value = null
  }

  // ---- Reconnection event handlers ----

  function onCoreDisconnected(): void {
    isReconnecting.value = true
    reconnectAttempt.value = 0
    status.value = 'error'
  }

  function onCoreReconnecting(attempt: number): void {
    isReconnecting.value = true
    reconnectAttempt.value = attempt
  }

  function onCoreReconnected(): void {
    isReconnecting.value = false
    reconnectAttempt.value = 0
    // Re-fetch status to get updated state
    fetchStatus()
  }

  function onCoreConnectionFailed(): void {
    isReconnecting.value = false
    reconnectAttempt.value = 0
    status.value = 'error'
    error.value = t('error.AI_CONNECTION_LOST')
    ElMessage.error(t('error.CORE_NOT_RUNNING'))
  }

  // ---- Listeners ----

  let cleanupProgress: (() => void) | null = null
  let cleanupStatus: (() => void) | null = null
  let cleanupReconnect: (() => void)[] = []

  function setupListeners(): void {
    cleanupProgress = window.ai.onDownloadProgress((progress: ModelDownloadProgress) => {
      downloadProgress.value = progress
    })
    cleanupStatus = window.ai.onStatusChanged((s: AISidecarStatus) => {
      status.value = s.status
      model.value = s.model
      port.value = s.port
      ramMB.value = s.ramMB
      tokPerSec.value = s.tokPerSec
      core.value = s.core
      error.value = s.error
    })

    // Reconnection events (if available on window.ai)
    if (typeof (window.ai as unknown as Record<string, unknown>).onCoreDisconnected === 'function') {
      cleanupReconnect.push(
        (window.ai as unknown as Record<string, unknown> & { onCoreDisconnected: (cb: () => void) => () => void })
          .onCoreDisconnected(() => onCoreDisconnected()),
      )
    }
    if (typeof (window.ai as unknown as Record<string, unknown>).onCoreReconnecting === 'function') {
      cleanupReconnect.push(
        (window.ai as unknown as Record<string, unknown> & { onCoreReconnecting: (cb: (a: number) => void) => () => void })
          .onCoreReconnecting((attempt: number) => onCoreReconnecting(attempt)),
      )
    }
    if (typeof (window.ai as unknown as Record<string, unknown>).onCoreReconnected === 'function') {
      cleanupReconnect.push(
        (window.ai as unknown as Record<string, unknown> & { onCoreReconnected: (cb: () => void) => () => void })
          .onCoreReconnected(() => onCoreReconnected()),
      )
    }
  }

  function cleanup(): void {
    cleanupProgress?.()
    cleanupStatus?.()
    for (const unsub of cleanupReconnect) unsub()
    cleanupReconnect = []
  }

  return {
    // State
    status,
    model,
    core,
    port,
    ramMB,
    tokPerSec,
    error,
    isDownloading,
    downloadProgress,
    autocompleteEnabled,
    grammarEnabled,
    summarizeEnabled,
    organizeEnabled,
    isReconnecting,
    reconnectAttempt,
    // Getters
    isReady,
    isStarting,
    hasModel,
    coreRunning,
    needsLightweightModel,
    statusLabel,
    statusDetail,
    // Actions
    fetchStatus,
    autocomplete,
    correctGrammar,
    summarize,
    chatWithContext,
    organize,
    downloadModel,
    importLocalModel,
    cancelDownload,
    setupListeners,
    cleanup,
    // Reconnection
    onCoreDisconnected,
    onCoreReconnecting,
    onCoreReconnected,
    onCoreConnectionFailed,
  }
})
