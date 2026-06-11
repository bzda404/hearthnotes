import { app } from 'electron'
import { appendFile, mkdir, readFile, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import type { MCPTelemetry, MCPPrivacyAuditEntry, MCPPrivacyTelemetry, MCPRagTelemetry } from '@shared/types/mcpTypes'

const rag: MCPRagTelemetry = {
  lastQuery: null,
  lastHitCount: 0,
  lastRerankUsedCore: false,
  lastRerankAttempted: 0,
  lastRerankSucceeded: 0,
  lastRerankFailed: 0,
  updatedAt: null,
}

const privacy: MCPPrivacyTelemetry = {
  pendingCount: 0,
  lastTool: null,
  lastClientName: null,
  lastDecision: null,
  auditLog: [],
  updatedAt: null,
}

let auditLoaded = false

export function recordRagTelemetry(update: Partial<Omit<MCPRagTelemetry, 'updatedAt'>>): void {
  Object.assign(rag, update, { updatedAt: new Date().toISOString() })
}

export function recordPrivacyTelemetry(update: Partial<Omit<MCPPrivacyTelemetry, 'updatedAt'>>): void {
  Object.assign(privacy, update, { updatedAt: new Date().toISOString() })
}

export function setPrivacyPendingCount(pendingCount: number): void {
  privacy.pendingCount = pendingCount
}

export function appendPrivacyAuditEntry(entry: MCPPrivacyAuditEntry): void {
  privacy.auditLog = [entry, ...privacy.auditLog].slice(0, 20)
  privacy.lastTool = entry.tool
  privacy.lastClientName = entry.clientName
  privacy.lastDecision = entry.decision
  privacy.updatedAt = entry.timestamp
  persistAuditEntry(entry).catch((err) => {
    console.warn('[MCP Audit] Failed to persist audit entry:', err)
  })
}

export async function loadPrivacyAuditLog(): Promise<MCPPrivacyAuditEntry[]> {
  try {
    const raw = await readFile(getAuditLogPath(), 'utf-8')
    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as MCPPrivacyAuditEntry)
      .filter(isAuditEntry)
      .slice(-20)
      .reverse()
    privacy.auditLog = entries
    auditLoaded = true
    return entries
  } catch {
    auditLoaded = true
    privacy.auditLog = []
    return []
  }
}

export async function ensurePrivacyAuditLogLoaded(): Promise<void> {
  if (!auditLoaded) await loadPrivacyAuditLog()
}

export async function clearPrivacyAuditLog(): Promise<void> {
  privacy.auditLog = []
  auditLoaded = true
  try {
    await unlink(getAuditLogPath())
  } catch {
    // Missing audit file is already the desired state.
  }
}

export function getMCPTelemetry(): MCPTelemetry {
  return {
    rag: { ...rag },
    privacy: { ...privacy, auditLog: [...privacy.auditLog] },
  }
}

export function resetMCPTelemetry(): void {
  Object.assign(rag, {
    lastQuery: null,
    lastHitCount: 0,
    lastRerankUsedCore: false,
    lastRerankAttempted: 0,
    lastRerankSucceeded: 0,
    lastRerankFailed: 0,
    updatedAt: null,
  })
  Object.assign(privacy, {
    pendingCount: 0,
    lastTool: null,
    lastClientName: null,
    lastDecision: null,
    auditLog: [],
    updatedAt: null,
  })
  auditLoaded = false
}

async function persistAuditEntry(entry: MCPPrivacyAuditEntry): Promise<void> {
  const filePath = getAuditLogPath()
  await mkdir(dirname(filePath), { recursive: true })
  await appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8')
}

function getAuditLogPath(): string {
  return join(app.getPath('userData'), 'mcp-audit-log.jsonl')
}

function isAuditEntry(value: unknown): value is MCPPrivacyAuditEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.requestId === 'string' &&
    typeof entry.tool === 'string' &&
    typeof entry.clientName === 'string' &&
    (entry.decision === 'allowed' || entry.decision === 'rejected' || entry.decision === 'desensitized' || entry.decision === 'timeout') &&
    typeof entry.piiCount === 'number' &&
    typeof entry.previewChars === 'number' &&
    typeof entry.timestamp === 'string'
}
