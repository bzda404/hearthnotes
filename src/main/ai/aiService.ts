/**
 * AI Service — 通过 AinCore 提供 AI 功能。
 *
 * @deprecated 此模块已废弃。所有调用内部委托给 CoreBridge (OAuth 2.0 PKCE)。
 * 请直接使用 `./coreBridge` 中的对应函数。
 *
 * 保留此文件仅为向后兼容，将在未来版本中移除。
 */
import * as coreBridge from './coreBridge'
import type {
  AutocompleteRequest,
  AutocompleteResponse,
  GrammarCorrectionRequest,
  GrammarCorrectionResponse,
  SummarizeRequest,
  SummarizeResponse,
  OrganizeRequest,
  OrganizeResponse,
} from '@shared/types/aiTypes'

let deprecationWarned = false

function warnDeprecation(method: string): void {
  if (!deprecationWarned) {
    console.warn(
      `[AinCore Notes] ⚠️ aiService.${method}() 已废弃。` +
        '请使用 coreBridge 中的等效函数。此兼容层将在未来版本中移除。',
    )
    deprecationWarned = true
  }
}

/**
 * 检查 AinCore 是否可用
 * @deprecated 使用 coreBridge.isCoreReady() 或 coreBridge.isModelHubAvailable()
 */
export async function isModelHubAvailable(): Promise<boolean> {
  warnDeprecation('isModelHubAvailable')
  return coreBridge.isModelHubAvailable()
}

/**
 * 自动补全
 * @deprecated 使用 coreBridge.autocomplete()
 */
export async function autocomplete(req: AutocompleteRequest): Promise<AutocompleteResponse> {
  warnDeprecation('autocomplete')
  return coreBridge.autocomplete(req)
}

/**
 * 语法纠正
 * @deprecated 使用 coreBridge.correctGrammar()
 */
export async function correctGrammar(
  req: GrammarCorrectionRequest,
): Promise<GrammarCorrectionResponse> {
  warnDeprecation('correctGrammar')
  return coreBridge.correctGrammar(req)
}

/**
 * 摘要
 * @deprecated 使用 coreBridge.summarize()
 */
export async function summarize(req: SummarizeRequest): Promise<SummarizeResponse> {
  warnDeprecation('summarize')
  return coreBridge.summarize(req)
}

/**
 * 整理笔记
 * @deprecated 使用 coreBridge.suggestOrganization()
 */
export async function suggestOrganization(req: OrganizeRequest): Promise<OrganizeResponse> {
  warnDeprecation('suggestOrganization')
  return coreBridge.suggestOrganization(req)
}
