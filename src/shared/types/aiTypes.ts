/**
 * Shared types for the AI sidecar layer (Layer 2).
 * Used by both main process and renderer.
 */

// Sidecar lifecycle states
export type SidecarStatus = 'stopped' | 'starting' | 'ready' | 'error'

// Model info returned by the sidecar
export interface ModelInfo {
  id?: string
  name: string
  path: string
  sizeBytes: number
  quantization: string
  parameters: string
  loadable?: boolean
  loadBlockReason?: string | null
}

export interface InstalledModelInfo {
  id: string
  name: string
  family?: string
  parameterSize: string
  quantization: string
  format?: 'gguf'
  capabilities?: string[]
  sizeBytes: number
  source?: string
  sourceUrl?: string
  filePath?: string
  digest?: string
  createdAt?: string
  status: 'installed' | 'loading' | 'loaded' | 'error'
  loadable: boolean
  loadBlockReason: string | null
}

// Status of the AI sidecar system
export interface AISidecarStatus {
  status: SidecarStatus
  model: ModelInfo | null
  transport: 'uds'
  socketPath: string | null
  core: {
    running: boolean
    startedByNote: boolean
    pid: number | null
    defaultModel: {
      loaded: boolean
      modelId: string | null
      reason: string | null
    } | null
    telemetry: {
      lastLatencyMs: number | null
      lastTokensPerSecond: number | null
      lastPromptTokens: number | null
      lastCompletionTokens: number | null
      lastTotalTokens: number | null
      updatedAt: string | null
    } | null
  }
  port: number | null
  ramMB: number | null
  tokPerSec: number | null
  lightweightPolicy: {
    maxParameterBillions: number
    description: string
  }
  error: string | null
}

// Autocomplete request from renderer
export interface AutocompleteRequest {
  context: string
  cursorPosition: number
  language?: string
}

// Autocomplete response
export interface AutocompleteResponse {
  completion: string
  latencyMs: number
}

// Grammar correction request
export interface GrammarCorrectionRequest {
  text: string
}

// Grammar correction response
export interface GrammarCorrectionResponse {
  corrected: string
  changes: Array<{ original: string; replacement: string; position: number }>
}

// Summarize request
export interface SummarizeRequest {
  text: string
  maxLength?: number
}

// Summarize response
export interface SummarizeResponse {
  summary: string
}

// Note metadata for organization suggestions
export interface NoteMeta {
  path: string
  title: string
  snippet: string
  currentFolder: string
}

// Organization suggestion
export interface FolderSuggestion {
  folderName: string
  notes: string[] // paths of notes that belong here
  reason: string
}

// Organization request/response
export interface OrganizeRequest {
  notes: NoteMeta[]
}

export interface OrganizeResponse {
  suggestions: FolderSuggestion[]
}

// Model download progress
export interface ModelDownloadProgress {
  percent: number
  downloadedBytes: number
  totalBytes: number
  speed: number // bytes per second
}

// Model download info
export interface ModelDownloadInfo {
  name: string
  size: string
  quantization: string
  downloadUrl: string
  fallbackUrl: string
  hash: string
}

// Chat with note context
export interface ChatWithContextRequest {
  message: string
  noteContent: string
  notePath?: string
}

export interface ChatWithContextResponse {
  reply: string
}

// AI feature flags
export interface AIFeatures {
  autocompleteEnabled: boolean
  grammarEnabled: boolean
  summarizeEnabled: boolean
  organizeEnabled: boolean
}

// Full AI state for Pinia store
export interface AIState {
  sidecarStatus: SidecarStatus
  model: ModelInfo | null
  features: AIFeatures
  isDownloading: boolean
  downloadProgress: ModelDownloadProgress | null
  error: string | null
}
