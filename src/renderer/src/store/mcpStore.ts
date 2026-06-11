/**
 * MCP Pinia store — manages MCP server and privacy popup state in the renderer.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  PendingPopup,
  PrivacyDecision,
  MCPServerStatus,
  MCPPrivacyAuditEntry,
} from '@shared/types/mcpTypes'

export type AuditDecisionFilter = 'all' | MCPPrivacyAuditEntry['decision']

export const useMCPStore = defineStore('mcp', () => {
  // ---- State ----
  const serverStatus = ref<MCPServerStatus>({
    running: false,
    transport: null,
    port: null,
    connectedClients: 0,
    knowledgeBasePath: null,
    telemetry: {
      rag: {
        lastQuery: null,
        lastHitCount: 0,
        lastRerankUsedCore: false,
        lastRerankAttempted: 0,
        lastRerankSucceeded: 0,
        lastRerankFailed: 0,
        updatedAt: null,
      },
      privacy: {
        pendingCount: 0,
        lastTool: null,
        lastClientName: null,
        lastDecision: null,
        auditLog: [],
        updatedAt: null,
      },
    },
  })
  const pendingPopup = ref<PendingPopup | null>(null)
  const recentDecisions = ref<PrivacyDecision[]>([])
  const auditDecisionFilter = ref<AuditDecisionFilter>('all')
  const countdown = ref(0)
  let countdownTimer: ReturnType<typeof setInterval> | null = null

  // ---- Getters ----
  const isRunning = computed(() => serverStatus.value.running)
  const hasPendingPopup = computed(() => !!pendingPopup.value)
  const sentinelLabel = computed(() => {
    const privacy = serverStatus.value.telemetry.privacy
    if (privacy.pendingCount > 0 || hasPendingPopup.value) return '等待授权'
    if (privacy.lastDecision === 'desensitized') return '已脱敏放行'
    if (privacy.lastDecision === 'allowed') return '已允许出域'
    if (privacy.lastDecision === 'rejected' || privacy.lastDecision === 'timeout') return '已拦截'
    return '待命'
  })
  const ragLabel = computed(() => {
    const rag = serverStatus.value.telemetry.rag
    if (!rag.updatedAt) return '未检索'
    return `${rag.lastHitCount} 命中 · ${rag.lastRerankUsedCore ? 'Core 重排' : 'BM25'}`
  })
  const filteredAudit = computed(() => {
    const audit = serverStatus.value.telemetry.privacy.auditLog
    if (auditDecisionFilter.value === 'all') return audit
    return audit.filter(entry => entry.decision === auditDecisionFilter.value)
  })
  const recentAudit = computed(() => filteredAudit.value.slice(0, 5))

  // ---- Actions ----

  async function fetchStatus(): Promise<void> {
    try {
      serverStatus.value = await window.mcp.getStatus()
    } catch (err) {
      console.error('[MCP Store] Failed to fetch status:', err)
    }
  }

  async function clearAuditLog(): Promise<void> {
    serverStatus.value = await window.mcp.clearAuditLog()
  }

  function acceptPopup(): void {
    if (!pendingPopup.value) return
    const decision: PrivacyDecision = {
      requestId: pendingPopup.value.request.id,
      allowed: true,
    }
    window.mcp.sendDecision(decision)
    recentDecisions.value.unshift(decision)
    if (recentDecisions.value.length > 50) recentDecisions.value.pop()
    clearPopup()
  }

  function rejectPopup(): void {
    if (!pendingPopup.value) return
    const decision: PrivacyDecision = {
      requestId: pendingPopup.value.request.id,
      allowed: false,
    }
    window.mcp.sendDecision(decision)
    recentDecisions.value.unshift(decision)
    if (recentDecisions.value.length > 50) recentDecisions.value.pop()
    clearPopup()
  }

  /**
   * 批准传输，但要求使用脱敏后的数据
   */
  function acceptDesensitized(): void {
    if (!pendingPopup.value) return
    const decision: PrivacyDecision = {
      requestId: pendingPopup.value.request.id,
      allowed: true,
      desensitize: true,
    }
    window.mcp.sendDecision(decision)
    recentDecisions.value.unshift(decision)
    if (recentDecisions.value.length > 50) recentDecisions.value.pop()
    clearPopup()
  }

  function clearPopup(): void {
    pendingPopup.value = null
    countdown.value = 0
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  function startCountdown(seconds: number): void {
    countdown.value = seconds
    if (countdownTimer) clearInterval(countdownTimer)
    countdownTimer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) {
        rejectPopup()
      }
    }, 1000)
  }

  // ---- Listeners ----

  let cleanupPopup: (() => void) | null = null

  function setupListeners(): void {
    cleanupPopup = window.mcp.onPrivacyPopup((popup: PendingPopup) => {
      pendingPopup.value = popup
      startCountdown(popup.expiresIn)
      fetchStatus()
    })
  }

  function cleanup(): void {
    cleanupPopup?.()
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }

  return {
    // State
    serverStatus,
    pendingPopup,
    recentDecisions,
    auditDecisionFilter,
    countdown,
    // Getters
    isRunning,
    hasPendingPopup,
    sentinelLabel,
    ragLabel,
    filteredAudit,
    recentAudit,
    // Actions
    fetchStatus,
    clearAuditLog,
    acceptPopup,
    acceptDesensitized,
    rejectPopup,
    clearPopup,
    setupListeners,
    cleanup,
  }
})
