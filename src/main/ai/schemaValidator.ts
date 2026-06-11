/**
 * AI 输出 Schema 校验器
 * 用于校验 1B 模型结构化输出的语义正确性
 */

interface ValidationResult<T> {
  success: boolean
  data: T | null
  errors: string[]
}

const AUTOCOMPLETE_MAX_CHARS = 240
const AUTOCOMPLETE_MAX_LINES = 3

/**
 * 自动补全输出清洗。
 * 小模型常会回显上下文、吐出角色标签、代码围栏或继续生成整段内容。
 * 这里把候选收束成适合 ghost text 的短片段。
 */
export function sanitizeAutocompleteCompletion(raw: string, context: string = ''): string {
  let completion = raw
    .replace(/\r\n/g, '\n')
    .replace(/^```(?:\w+)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .replace(/^(?:assistant|ai|completion|output)\s*[:：]\s*/i, '')

  const trimmedContext = context.trimEnd()
  if (trimmedContext && completion.startsWith(trimmedContext)) {
    completion = completion.slice(trimmedContext.length)
  }

  completion = completion
    .replace(/^\s+/, '')
    .replace(/^(?:assistant|ai|completion|output)\s*[:：]\s*/i, '')

  const lines = completion.split('\n')
  const safeLines: string[] = []
  for (const line of lines) {
    const normalized = line.trimEnd()
    if (/^```/.test(normalized)) break
    if (/^#{1,6}\s+/.test(normalized) && safeLines.length > 0) break
    if (/^(?:user|system|assistant)\s*[:：]/i.test(normalized)) break
    safeLines.push(normalized)
    if (safeLines.length >= AUTOCOMPLETE_MAX_LINES) break
  }

  completion = safeLines.join('\n').slice(0, AUTOCOMPLETE_MAX_CHARS)
  return completion.trimEnd()
}

/**
 * 校验语法纠正结果
 */
export function validateGrammarResult(raw: unknown): ValidationResult<{ corrected: string; changes: Array<{ original: string; replacement: string; position: number }> }> {
  if (typeof raw !== 'object' || raw === null) {
    return { success: false, data: null, errors: ['输出不是对象'] }
  }
  const obj = raw as Record<string, unknown>
  const errors: string[] = []

  if (typeof obj.corrected !== 'string') errors.push('corrected 字段必须是字符串')
  if (!Array.isArray(obj.changes)) errors.push('changes 字段必须是数组')

  if (errors.length > 0) {
    return { success: false, data: null, errors }
  }

  // 校验每个 change 的结构
  const changes = (obj.changes as unknown[]).filter((c: unknown) => {
    if (typeof c !== 'object' || c === null) return false
    const change = c as Record<string, unknown>
    return typeof change.original === 'string' && typeof change.replacement === 'string'
  }).map((c: unknown) => {
    const change = c as Record<string, unknown>
    return {
      original: String(change.original),
      replacement: String(change.replacement),
      position: typeof change.position === 'number' ? change.position : 0,
    }
  })

  return {
    success: true,
    data: { corrected: String(obj.corrected), changes },
    errors: [],
  }
}

/**
 * 校验整理建议结果
 */
export function validateOrganizeResult(raw: unknown): ValidationResult<{ suggestions: Array<{ folderName: string; notes: string[]; reason: string }> }> {
  if (typeof raw !== 'object' || raw === null) {
    return { success: false, data: null, errors: ['输出不是对象'] }
  }
  const obj = raw as Record<string, unknown>

  if (!Array.isArray(obj.suggestions)) {
    return { success: false, data: null, errors: ['suggestions 字段必须是数组'] }
  }

  const suggestions = (obj.suggestions as unknown[]).filter((s: unknown) => {
    if (typeof s !== 'object' || s === null) return false
    const sug = s as Record<string, unknown>
    return typeof sug.folderName === 'string'
  }).map((s: unknown) => {
    const sug = s as Record<string, unknown>
    return {
      folderName: String(sug.folderName),
      notes: Array.isArray(sug.notes) ? sug.notes.map(String) : [],
      reason: String(sug.reason || ''),
    }
  })

  return { success: true, data: { suggestions }, errors: [] }
}

/**
 * 通用正则修复 — 处理常见的 JSON 格式问题
 */
export function regexFixJson(raw: string): string {
  let fixed = raw.trim()
  // 去除 markdown 代码围栏
  fixed = fixed.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')
  // 去除尾部逗号
  fixed = fixed.replace(/,\s*([}\]])/g, '$1')
  // 修复未转义的换行符在字符串中
  fixed = fixed.replace(/: "([^"]*)\n([^"]*)"/g, ': "$1\\n$2"')
  return fixed
}
