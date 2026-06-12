/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Core Bridge — Notes 与 AinCore 的通信层
 *
 * 使用 @aincore/sdk 中 AinCoreClient + OAuth 2.0 PKCE 完成授权和通信。
 * 替代原有的 modelHubClient.ts + udsClient.ts + coreSupervisor.ts。
 *
 * Notes 作为 Core 应用市场的第一个内置应用:
 *   - 启动时自动向 Core 注册 OAuth 客户端
 *   - 获取 authorizationCode (首次自动同意, first-party app)
 *   - 换取 access_token + refresh_token
 *   - 将所有 AI 请求通过 SDK 转发到 Core
 *   - token 过期前自动刷新 (由 SDK getAccessToken() 处理)
 *   - 运行时 Core 被 kill 后自动重连（指数退避）
 */
import { AinCoreClient, generatePKCE } from '@aincore/sdk'
import type { OAuthTokenSet, OAuthClientConfig } from '@aincore/sdk'
import type {
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
} from '@shared/types/aiTypes'
import { IncrementalJsonRepair } from './jsonRepair'
import {
  sanitizeAutocompleteCompletion,
  validateGrammarResult,
  validateOrganizeResult,
  regexFixJson,
} from './schemaValidator'
import { BrowserWindow } from 'electron'

// ============================================================
// Configuration
// ============================================================

const DISCOVERY_RETRY_ATTEMPTS = 5
const DISCOVERY_RETRY_DELAY_MS = 2000
const HEALTH_CHECK_INTERVAL_MS = 30_000 // 30s
const RECONNECT_BASE_DELAY_MS = 2000
const RECONNECT_MAX_ATTEMPTS = 10
const RECONNECT_MAX_DELAY_MS = 32_000 // 2^5 * 2000 = 64000, capped at 32s

// ============================================================
// AinCoreClient singleton
// ============================================================

const client = new AinCoreClient({
  name: 'AinCore Notes',
  icon: '📝',
  vendor: 'AinCore',
})

let oauthReady = false
let oauthInitPromise: Promise<boolean> | null = null

// ============================================================
// Reconnection state
// ============================================================

let healthCheckTimer: ReturnType<typeof setInterval> | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectAttempt = 0
let isConnected = false

type ConnectionStateListener = (event: 'disconnected' | 'reconnecting' | 'reconnected' | 'failed', attempt?: number) => void
const connectionListeners: ConnectionStateListener[] = []

function emitConnectionState(event: 'disconnected' | 'reconnecting' | 'reconnected' | 'failed', attempt?: number) {
  for (const listener of connectionListeners) {
    try { listener(event, attempt) } catch { /* ignore */ }
  }
  // Also notify renderer via IPC if BrowserWindow is available
  try {
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      if (!win.isDestroyed()) {
        win.webContents.send(`core:${event}`, attempt)
      }
    }
  } catch {
    // BrowserWindow may not be available in some contexts
  }
}

export function onConnectionStateChange(listener: ConnectionStateListener): () => void {
  connectionListeners.push(listener)
  return () => {
    const idx = connectionListeners.indexOf(listener)
    if (idx >= 0) connectionListeners.splice(idx, 1)
  }
}

// ============================================================
// PKCE State — 每次授权流程生成新的
// ============================================================

let pkceState: { verifier: string; challenge: string } | null = null

function ensurePKCE(): { verifier: string; challenge: string } {
  if (!pkceState) {
    pkceState = generatePKCE()
  }
  return pkceState!
}

// ============================================================
// Notes OAuth scopes — Core 应用市场中预定义
// ============================================================

const NOTES_SCOPES = [
  'inference:read',
  'models:read',
  'knowledge:read',
  'knowledge:write',
  'system:status',
  'offline_access',
].join(' ')

// ============================================================
// Helpers
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 带重试的 Core 发现 — Core 可能还在启动中
 */
async function discoverWithRetry() {
  for (let attempt = 1; attempt <= DISCOVERY_RETRY_ATTEMPTS; attempt++) {
    const discovery = await client.discover()
    if (discovery) return discovery

    if (attempt < DISCOVERY_RETRY_ATTEMPTS) {
      console.log(
        `[Notes Bridge] Core 未就绪，${DISCOVERY_RETRY_DELAY_MS}ms 后重试 (${attempt}/${DISCOVERY_RETRY_ATTEMPTS})`,
      )
      await sleep(DISCOVERY_RETRY_DELAY_MS)
    }
  }
  return null
}

// ============================================================
// Initialize — 连接 Core 并完成 OAuth 授权
// ============================================================

export async function initializeCoreBridge(): Promise<boolean> {
  if (oauthInitPromise) return oauthInitPromise

  oauthInitPromise = (async () => {
    try {
      // 1. 发现 Core (带重试，Core 可能还在启动)
      const discovery = await discoverWithRetry()
      if (!discovery) {
        console.log('[Notes Bridge] AinCore 未运行，AI 功能不可用')
        return false
      }

      console.log(`[Notes Bridge] 已连接到 AinCore v${discovery.protocol_version}`)

      // 2. 注册 OAuth 客户端
      const config = await client.registerOAuth()
      console.log(`[Notes Bridge] OAuth 客户端已注册: ${config.client_id}`)

      // 3. 发起 OAuth 授权 (first-party app → Core 自动同意，无需用户弹窗)
      const { verifier, challenge } = ensurePKCE()
      const { authorizationCode } = await client.authorize(NOTES_SCOPES, challenge)
      console.log('[Notes Bridge] OAuth 授权码已获取 (first-party auto-consent)')

      // 4. 换取 token (包含 refresh_token 用于自动续期)
      const tokenSet = await client.exchangeCode(authorizationCode, verifier)
      console.log(
        `[Notes Bridge] OAuth 授权成功, token 有效期 ${tokenSet.expires_in}s` +
          (tokenSet.refresh_token ? ', refresh_token 已获取' : ''),
      )

      oauthReady = true
      isConnected = true
      reconnectAttempt = 0
      return true
    } catch (err) {
      console.error('[Notes Bridge] Core 连接失败:', err)
      oauthReady = false
      isConnected = false
      return false
    }
  })()

  return oauthInitPromise
}

/**
 * 重置初始化状态，允许重新尝试连接
 * 用于 Core 重启或之前连接失败后的恢复
 */
export function resetCoreBridge(): void {
  oauthReady = false
  oauthInitPromise = null
  pkceState = null
  isConnected = false
  reconnectAttempt = 0
}

export function isCoreReady(): boolean {
  return oauthReady
}

export async function getCoreRuntimeStatus() {
  if (!oauthReady) return null
  try {
    return await client.getStatus()
  } catch {
    return null
  }
}

/**
 * 确保 OAuth 已就绪，未就绪时尝试初始化
 * 用于 AI 功能调用前的守卫，实现延迟连接
 */
async function ensureReady(): Promise<boolean> {
  if (oauthReady) return true
  // 如果之前失败，允许重新尝试
  if (oauthInitPromise) {
    const result = await oauthInitPromise
    if (result) return true
    // 上次失败了，重置后重试
    resetCoreBridge()
  }
  return initializeCoreBridge()
}

export async function shutdownCoreBridge(): Promise<void> {
  stopHealthCheck()
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (oauthReady) {
    try {
      await client.revokeAuth()
    } catch {
      // 静默
    }
  }
  client.disconnect()
  oauthReady = false
  oauthInitPromise = null
  pkceState = null
  isConnected = false
}

// ============================================================
// Health Check + Auto-Reconnection
// ============================================================

function startHealthCheck(): void {
  if (healthCheckTimer) return
  healthCheckTimer = setInterval(async () => {
    if (!oauthReady) return

    try {
      // Lightweight health probe
      await client.getStatus()
    } catch {
      // Core is gone — begin reconnection
      console.warn('[Notes Bridge] Health check failed, Core may be offline')
      oauthReady = false
      isConnected = false
      emitConnectionState('disconnected')
      startReconnect()
    }
  }, HEALTH_CHECK_INTERVAL_MS)
}

function stopHealthCheck(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer)
    healthCheckTimer = null
  }
}

function startReconnect(): void {
  if (reconnectTimer) return // already reconnecting
  reconnectAttempt = 0
  scheduleReconnectAttempt()
}

function scheduleReconnectAttempt(): void {
  if (reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
    console.error('[Notes Bridge] Max reconnection attempts reached, giving up')
    emitConnectionState('failed', reconnectAttempt)
    reconnectTimer = null
    return
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempt),
    RECONNECT_MAX_DELAY_MS,
  )

  reconnectAttempt++
  emitConnectionState('reconnecting', reconnectAttempt)
  console.log(`[Notes Bridge] Reconnect attempt ${reconnectAttempt} in ${delay}ms`)

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null

    try {
      const discovery = await client.discover()
      if (!discovery) {
        // Still not available, try again
        scheduleReconnectAttempt()
        return
      }

      console.log(`[Notes Bridge] Core rediscovered: v${discovery.protocol_version}`)

      // Re-walk OAuth flow
      resetCoreBridge()
      const success = await initializeCoreBridge()

      if (success) {
        console.log('[Notes Bridge] Reconnected to Core successfully')
        startHealthCheck()
        emitConnectionState('reconnected')
      } else {
        scheduleReconnectAttempt()
      }
    } catch (err) {
      console.warn('[Notes Bridge] Reconnect attempt failed:', err)
      scheduleReconnectAttempt()
    }
  }, delay)
}

// ============================================================
// AI Feature wrappers — 通过 SDK 转发到 Core
// 所有请求通过 OAuth access_token 认证
// token 过期前 SDK 自动刷新 (getAccessToken 内部处理)
// ============================================================

const MAX_RETRIES = 2

/**
 * 检查 AinCore 是否可用 (兼容 aiService 接口)
 */
export async function isModelHubAvailable(): Promise<boolean> {
  return ensureReady()
}

/**
 * 自动补全
 */
export async function autocomplete(req: AutocompleteRequest): Promise<AutocompleteResponse> {
  if (!oauthReady) {
    throw new Error('AinCore 未连接，请先启动 Core')
  }

  const start = Date.now()
  const beforeCursor = req.context.slice(0, req.cursorPosition)
  const lines = beforeCursor.split('\n')
  const contextLines = lines.slice(-5).join('\n')

  const result = await client.chat({
    messages: [{ role: 'user', content: `请补全以下 Markdown 内容，只输出补全的部分，不要其他解释：\n${contextLines}` }],
    max_tokens: 64,
    temperature: 0.2,
    extra: { _skip_profile_injection: true },
  })

  return {
    completion: sanitizeAutocompleteCompletion(result.content, contextLines),
    latencyMs: Date.now() - start,
  }
}

/**
 * 语法纠正
 */
export async function correctGrammar(req: GrammarCorrectionRequest): Promise<GrammarCorrectionResponse> {
  if (!oauthReady) {
    return { corrected: req.text, changes: [] }
  }

  const SYSTEM_PROMPT = `你是语法纠错引擎。只输出JSON，禁止任何解释。

输入: "这是一个测试句字，有语发错误。"
输出: {"corrected":"这是一个测试句子，有语法错误。","changes":[{"original":"句字","replacement":"句子","position":5},{"original":"语发","replacement":"语法","position":10}]}

输入: "The quik brown fox jump over the lazy dog."
输出: {"corrected":"The quick brown fox jumps over the lazy dog.","changes":[{"original":"quik","replacement":"quick","position":4},{"original":"jump","replacement":"jumps","position":20}]}`

  const fallback: GrammarCorrectionResponse = { corrected: req.text, changes: [] }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await client.chat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `"${req.text}"` },
        ],
        max_tokens: Math.max(512, req.text.length * 2),
        temperature: 0.1,
        extra: { _skip_profile_injection: true },
      })

      const repairer = new IncrementalJsonRepair()
      const cleaned = regexFixJson(result.content)
      repairer.push(cleaned)
      const parsed = repairer.tryParse<Record<string, unknown>>()

      if (!parsed) continue

      const validated = validateGrammarResult(parsed)
      if (validated.success && validated.data) {
        return {
          corrected: validated.data.corrected,
          changes: validated.data.changes,
        }
      }
    } catch {
      // 静默重试
    }
  }

  return fallback
}

/**
 * 摘要
 */
export async function summarize(req: SummarizeRequest): Promise<SummarizeResponse> {
  if (!oauthReady) {
    return { summary: '' }
  }

  const maxLen = req.maxLength ?? 150
  const SYSTEM_PROMPT = `你是摘要引擎。用 ${maxLen} 字以内总结给定文本。只输出摘要，不要其他内容。`

  const text = req.text.length > 2000 ? req.text.slice(0, 2000) + '...' : req.text

  const result = await client.chat({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    max_tokens: maxLen * 2,
    temperature: 0.3,
    extra: { _skip_profile_injection: true },
  })

  return { summary: result.content.trim() }
}

/**
 * 整理笔记
 */
export async function suggestOrganization(req: OrganizeRequest): Promise<OrganizeResponse> {
  if (!oauthReady) {
    return { suggestions: [] }
  }

  const noteList = req.notes
    .map((n) => `- [${n.path}] 标题: "${n.title}", 摘要: "${n.snippet.slice(0, 100)}", 当前: "${n.currentFolder}"`)
    .join('\n')

  const SYSTEM_PROMPT = `你是知识库整理引擎。给定笔记列表，建议文件夹分组。只输出JSON，禁止任何解释。

示例输入:
- [a.md] 标题: "React Hooks 入门", 摘要: "useState 和 useEffect 的用法", 当前: "未分类"
- [b.md] 标题: "Vue3 组合式API", 摘要: "setup 函数和 ref", 当前: "未分类"
- [c.md] 标题: "红烧肉做法", 摘要: "五花肉切块，酱油焖煮", 当前: "未分类"

示例输出:
{"suggestions":[{"folderName":"前端框架","notes":["a.md","b.md"],"reason":"都是前端框架相关的技术笔记"},{"folderName":"美食","notes":["c.md"],"reason":"烹饪食谱"}]}

笔记列表:
${noteList}

输出: `

  const fallback: OrganizeResponse = { suggestions: [] }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await client.chat({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: noteList },
        ],
        max_tokens: 1024,
        temperature: 0.4,
        extra: { _skip_profile_injection: true },
      })

      const repairer = new IncrementalJsonRepair()
      const cleaned = regexFixJson(result.content)
      repairer.push(cleaned)
      const parsed = repairer.tryParse<Record<string, unknown>>()

      if (!parsed) continue

      const validated = validateOrganizeResult(parsed)
      if (validated.success && validated.data) {
        return { suggestions: validated.data.suggestions }
      }
    } catch {
      // 静默重试
    }
  }

  return fallback
}

/**
 * 带笔记上下文的通用聊天
 * 将笔记内容 + 用户消息一起发给模型，使模型能基于笔记内容回答
 */
export async function chatWithContext(req: ChatWithContextRequest): Promise<ChatWithContextResponse> {
  if (!oauthReady) {
    return { reply: '' }
  }

  const noteText = req.noteContent.length > 4000
    ? req.noteContent.slice(0, 4000) + '...'
    : req.noteContent

  const systemPrompt = req.noteContent
    ? `你是 AinCore Notes 的 AI 助手。用户正在编辑一篇笔记，请基于笔记内容回答用户的问题。\n\n## 当前笔记内容\n\n${noteText}`
    : `你是 AinCore Notes 的 AI 助手。请回答用户的问题。`

  try {
    const result = await client.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: req.message },
      ],
      max_tokens: 512,
      temperature: 0.5,
      extra: { _skip_profile_injection: true },
    })
    return { reply: result.content.trim() }
  } catch {
    return { reply: '' }
  }
}

// ============================================================
// Legacy compatibility — re-export modelHubClient for gradual migration
// ============================================================

import { modelHubClient } from './modelHubClient'

export { modelHubClient }
export { startHealthCheck, stopHealthCheck }
