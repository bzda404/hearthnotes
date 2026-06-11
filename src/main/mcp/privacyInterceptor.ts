/**
 * MCP 哨兵网关 — Promise 异步挂起机制
 *
 * 当外部 MCP 客户端（如 Claude Desktop）发起 tools/call 请求时：
 * 1. 拦截请求，创建悬停 Promise 存入 Map
 * 2. 在挂起伞下安全执行数据检索
 * 3. IPC 发送 SECURITY_PROMPT 到渲染进程
 * 4. 用户决策 → resolve/reject → 数据回传或 Access Denied
 */
import { BrowserWindow } from 'electron'
import { desensitizeSync } from '../ai/desensitizer'
import { appendPrivacyAuditEntry, recordPrivacyTelemetry, setPrivacyPendingCount } from './telemetry'
import type { PendingPopup, PrivacyInterceptorConfig } from '@shared/types/mcpTypes'

interface PendingRequest {
  resolve: (result: InterceptResult) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
  context: {
    tool: string
    args: Record<string, unknown>
    clientName: string
    clientPid?: number
    piiCount: number
    previewChars: number
  }
}

export interface InterceptResult {
  allowed: boolean
  desensitize: boolean
}

const DEFAULT_CONFIG: PrivacyInterceptorConfig = {
  enabled: true,
  timeoutSeconds: 60,
  autoRejectOnTimeout: true,
  desensitizeEnabled: true,
  allowedTools: [],
}

let config = { ...DEFAULT_CONFIG }
const pendingRequests = new Map<string, PendingRequest>()
let requestCounter = 0

export function configurePrivacyInterceptor(newConfig: Partial<PrivacyInterceptorConfig>): void {
  config = { ...config, ...newConfig }
}

/**
 * 核心拦截函数 — 创建悬停 Promise，等待用户决策
 *
 * @returns InterceptResult — { allowed, desensitize }
 */
export function interceptRequest(
  tool: string,
  args: Record<string, unknown>,
  clientName: string,
  clientPid?: number,
  previewData?: string
): Promise<InterceptResult> {
  // 如果拦截器关闭，直接放行
  if (!config.enabled) return Promise.resolve({ allowed: true, desensitize: false })

  // 如果工具在白名单中，直接放行
  if (config.allowedTools.includes(tool)) return Promise.resolve({ allowed: true, desensitize: false })

  const requestId = `req_${++requestCounter}_${Date.now()}`

  return new Promise<InterceptResult>((resolve, reject) => {
    const preview = config.desensitizeEnabled && previewData
      ? desensitizeSync(previewData)
      : { original: previewData || '', masked: previewData || '', entitiesFound: [] }

    // 设置超时自动拒绝
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      recordPrivacyTelemetry({
        pendingCount: pendingRequests.size,
        lastTool: tool,
        lastClientName: clientName,
        lastDecision: 'timeout',
      })
      appendPrivacyAuditEntry({
        requestId,
        tool,
        clientName,
        decision: 'timeout',
        piiCount: preview.entitiesFound.length,
        previewChars: preview.masked.length,
        timestamp: new Date().toISOString(),
      })
      if (config.autoRejectOnTimeout) {
        resolve({ allowed: false, desensitize: false }) // 超时 = 拒绝
      } else {
        reject(new Error('Privacy decision timeout'))
      }
    }, config.timeoutSeconds * 1000)

    // 存入挂起请求 Map
    pendingRequests.set(requestId, {
      resolve,
      reject,
      timeout,
      context: {
        tool,
        args,
        clientName,
        clientPid,
        piiCount: preview.entitiesFound.length,
        previewChars: preview.masked.length,
      },
    })
    recordPrivacyTelemetry({
      pendingCount: pendingRequests.size,
      lastTool: tool,
      lastClientName: clientName,
      lastDecision: null,
    })

    // 构造弹窗数据
    const popup: PendingPopup = {
      request: {
        id: requestId,
        tool,
        args,
        clientName,
        timestamp: Date.now(),
      },
      preview,
      expiresIn: config.timeoutSeconds,
    }

    // IPC 发送到所有渲染窗口
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('mt::mcp::privacy-popup', popup)
      }
    }
  })
}

/**
 * 处理用户的隐私决策（从渲染进程 IPC 调用）
 */
export function handleDecision(requestId: string, allowed: boolean, desensitize: boolean = false): void {
  const pending = pendingRequests.get(requestId)
  if (!pending) return

  clearTimeout(pending.timeout)
  pendingRequests.delete(requestId)
  recordPrivacyTelemetry({
    pendingCount: pendingRequests.size,
    lastTool: pending.context.tool,
    lastClientName: pending.context.clientName,
    lastDecision: allowed ? (desensitize ? 'desensitized' : 'allowed') : 'rejected',
  })
  appendPrivacyAuditEntry({
    requestId,
    tool: pending.context.tool,
    clientName: pending.context.clientName,
    decision: allowed ? (desensitize ? 'desensitized' : 'allowed') : 'rejected',
    piiCount: pending.context.piiCount,
    previewChars: pending.context.previewChars,
    timestamp: new Date().toISOString(),
  })
  pending.resolve({ allowed, desensitize })
}

/**
 * 获取当前挂起的请求数量
 */
export function getPendingCount(): number {
  setPrivacyPendingCount(pendingRequests.size)
  return pendingRequests.size
}
