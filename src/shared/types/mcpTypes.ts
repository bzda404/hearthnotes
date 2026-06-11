/**
 * Shared types for the MCP privacy sentinel layer (Layer 3).
 * Used by both main process and renderer.
 */

// Intercepted MCP request
export interface InterceptedRequest {
  id: string
  tool: string
  args: Record<string, unknown>
  clientName: string
  timestamp: number
}

// Desensitized data preview shown in the privacy popup
export interface DesensitizedPreview {
  original: string
  masked: string
  entitiesFound: PIIEntity[]
}

// PII entity detected by the desensitizer
export interface PIIEntity {
  type: 'phone' | 'id_number' | 'email' | 'name' | 'address' | 'bank_card' | 'other'
  value: string
  start: number
  end: number
}

// User's privacy decision
export interface PrivacyDecision {
  requestId: string
  allowed: boolean
  desensitize?: boolean // true = use masked data instead of original
}

// Pending popup data sent from main to renderer
export interface PendingPopup {
  request: InterceptedRequest
  preview: DesensitizedPreview
  expiresIn: number // seconds until auto-reject
}

// MCP server status
export interface MCPServerStatus {
  running: boolean
  transport: 'stdio' | 'http' | null
  port: number | null
  connectedClients: number
  knowledgeBasePath: string | null
  telemetry: MCPTelemetry
}

export interface MCPRagTelemetry {
  lastQuery: string | null
  lastHitCount: number
  lastRerankUsedCore: boolean
  lastRerankAttempted: number
  lastRerankSucceeded: number
  lastRerankFailed: number
  updatedAt: string | null
}

export interface MCPPrivacyTelemetry {
  pendingCount: number
  lastTool: string | null
  lastClientName: string | null
  lastDecision: 'allowed' | 'rejected' | 'desensitized' | 'timeout' | null
  auditLog: MCPPrivacyAuditEntry[]
  updatedAt: string | null
}

export interface MCPPrivacyAuditEntry {
  requestId: string
  tool: string
  clientName: string
  decision: 'allowed' | 'rejected' | 'desensitized' | 'timeout'
  piiCount: number
  previewChars: number
  timestamp: string
}

export interface MCPTelemetry {
  rag: MCPRagTelemetry
  privacy: MCPPrivacyTelemetry
}

// MCP tool result
export interface MCPToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

// Note search result (used by search_notes tool)
export interface NoteSearchResult {
  path: string
  title: string
  snippet: string
  matchCount: number
  score: number
}

// Note metadata (used by list_notes tool)
export interface NoteListItem {
  path: string
  title: string
  size: number
  lastModified: string
  isDirectory: boolean
}

// Full MCP state for Pinia store
export interface MCPState {
  serverStatus: MCPServerStatus
  pendingPopup: PendingPopup | null
  recentDecisions: PrivacyDecision[]
}

// Privacy interceptor configuration
export interface PrivacyInterceptorConfig {
  enabled: boolean
  timeoutSeconds: number // default 60
  autoRejectOnTimeout: boolean // default true
  desensitizeEnabled: boolean // default true
  allowedTools: string[] // tools that bypass the popup
}
