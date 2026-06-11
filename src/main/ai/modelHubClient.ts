/**
 * AinCore 客户端 — 通过 UDS 连接 Core
 * 纯 Unix Domain Socket 通信，无 HTTP
 */
import { udsClient } from './udsClient'

interface ChatResponse {
  choices?: Array<{ message?: { content?: string } }>
}

interface CompletionResponse {
  choices?: Array<{ text?: string }>
}

export interface RegisterLocalModelRequest {
  [key: string]: unknown
  id?: string
  name: string
  family?: string
  parameterSize?: string
  quantization: string
  source?: string
  sourceUrl?: string
  filePath: string
  sizeBytes?: number
}

export class ModelHubClient {
  /**
   * 检测 AinCore 是否可用
   */
  async discover(): Promise<boolean> {
    return udsClient.connect()
  }

  /**
   * 获取状态
   */
  async getStatus(): Promise<Record<string, unknown> | null> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) return null
    }
    return udsClient.call('internal.status') as Promise<Record<string, unknown> | null>
  }

  /**
   * 列出模型
   */
  async listModels(): Promise<Array<Record<string, unknown>>> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) return []
    }
    return udsClient.call('internal.models.list') as Promise<Array<Record<string, unknown>>>
  }

  /**
   * 加载模型
   */
  async loadModel(id: string): Promise<void> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) throw new Error('无法连接到 AinCore，请先启动 Core')
    }
    await udsClient.call('internal.models.load', { id })
  }

  /**
   * 卸载模型
   */
  async unloadModel(): Promise<void> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) return // 静默失败
    }
    await udsClient.call('internal.models.unload')
  }

  /**
   * 删除模型
   */
  async deleteModel(id: string): Promise<void> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) throw new Error('无法连接到 AinCore，请先启动 Core')
    }
    await udsClient.call('internal.models.delete', { id })
  }

  /**
   * 注册本地 GGUF 模型，并让 Core 尝试按轻量策略自动加载。
   */
  async registerLocalModel(params: RegisterLocalModelRequest): Promise<Record<string, unknown>> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) throw new Error('无法连接到 AinCore，请先启动 Core')
    }
    return udsClient.call('internal.models.register', params) as Promise<Record<string, unknown>>
  }

  /**
   * 聊天补全
   */
  async chat(params: {
    messages: Array<{ role: string; content: string }>
    max_tokens?: number
    temperature?: number
    stream?: boolean
  }): Promise<string> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) throw new Error('无法连接到 AinCore')
    }
    const result = await udsClient.call('internal.chat.completions', params) as ChatResponse
    return result?.choices?.[0]?.message?.content ?? ''
  }

  /**
   * 文本补全
   */
  async complete(prompt: string, options?: { max_tokens?: number; temperature?: number; stop?: string[] }): Promise<string> {
    if (!udsClient.isConnected()) {
      const ok = await udsClient.connect()
      if (!ok) throw new Error('无法连接到 AinCore')
    }
    const result = await udsClient.call('internal.completions', { prompt, ...options }) as CompletionResponse
    return result?.choices?.[0]?.text ?? ''
  }
}

export const modelHubClient = new ModelHubClient()
