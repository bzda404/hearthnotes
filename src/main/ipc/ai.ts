/**
 * AI IPC 处理器 — 通过 AinCore OAuth SDK 提供 AI 功能
 *
 * Notes 使用 @aincore/sdk 和 coreBridge.ts 取代原有的底层连接。
 * 模型管理移到 Core Admin UI；Notes 只负责 AI 功能的 IPC 分发。
 */
import { ipcMain } from 'electron'
import { initializeCoreBridge, shutdownCoreBridge, isCoreReady, getCoreRuntimeStatus, startHealthCheck } from '../ai/coreBridge'
import * as aiService from '../ai/coreBridge'
import type { AISidecarStatus } from '@shared/types/aiTypes'

const lightweightPolicy = {
  maxParameterBillions: 1,
  description: 'AinCore 当前只加载 ≤1B 参数的本地量化模型',
}

export const registerAIHandlers = (): void => {
  ipcMain.handle('mt::ai::status', async(): Promise<AISidecarStatus> => {
    return getAIStatus()
  })

  ipcMain.handle('mt::ai::autocomplete', async(_event, req) => {
    return aiService.autocomplete(req)
  })

  ipcMain.handle('mt::ai::correct-grammar', async(_event, req) => {
    return aiService.correctGrammar(req)
  })

  ipcMain.handle('mt::ai::summarize', async(_event, req) => {
    return aiService.summarize(req)
  })

  ipcMain.handle('mt::ai::organize', async(_event, req) => {
    return aiService.suggestOrganization(req)
  })

  ipcMain.handle('mt::ai::is-model-present', async() => {
    return isCoreReady()
  })
}

async function getAIStatus(): Promise<AISidecarStatus> {
  const ready = isCoreReady()
  const coreStatus = await getCoreRuntimeStatus()
  const status = ready && coreStatus?.status === 'ready'
    ? 'ready'
    : 'stopped'

  return {
    status,
    model: coreStatus?.loadedModel
      ? {
        id: coreStatus.loadedModel,
        name: coreStatus.loadedModel,
        path: '',
        parameters: '≤1B',
        quantization: 'Q4_K_M',
        sizeBytes: 0,
      }
      : null,
    transport: 'uds',
    socketPath: '/tmp/aincore.sock',
    core: {
      running: ready,
      startedByNote: false,
      pid: null,
      defaultModel: coreStatus?.loadedModel
        ? { loaded: true, modelId: coreStatus.loadedModel, reason: null }
        : null,
      telemetry: null,
    },
    port: null,
    ramMB: null,
    tokPerSec: null,
    lightweightPolicy,
    error: ready ? (coreStatus?.status === 'ready' ? null : 'AinCore 已连接，但模型尚未运行') : 'AinCore 未运行',
  }
}

export async function initializeAI(): Promise<void> {
  const connected = await initializeCoreBridge()
  if (connected) {
    console.log('[AinCore Notes] 已通过 OAuth 连接到 AinCore')
    // Start periodic health check for auto-reconnection
    startHealthCheck()
  } else {
    console.log('[AinCore Notes] AinCore 未运行，AI 功能不可用')
  }
}

export async function shutdownAI(): Promise<void> {
  await shutdownCoreBridge()
}
