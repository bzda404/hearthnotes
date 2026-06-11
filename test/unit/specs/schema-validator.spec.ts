/**
 * Schema Validator unit tests
 */
import { describe, it, expect } from 'vitest'
import {
  sanitizeAutocompleteCompletion,
  validateGrammarResult,
  validateOrganizeResult,
  regexFixJson,
} from 'main_renderer/ai/schemaValidator'

describe('validateGrammarResult', () => {
  it('should accept valid grammar result', () => {
    const result = validateGrammarResult({
      corrected: '这是正确句子',
      changes: [
        { original: '错字', replacement: '对字', position: 2 },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.corrected).toBe('这是正确句子')
    expect(result.data?.changes.length).toBe(1)
  })

  it('should reject non-object input', () => {
    const result = validateGrammarResult('not an object')
    expect(result.success).toBe(false)
  })

  it('should reject null input', () => {
    const result = validateGrammarResult(null)
    expect(result.success).toBe(false)
  })

  it('should filter invalid changes', () => {
    const result = validateGrammarResult({
      corrected: 'test',
      changes: [
        { original: 'a', replacement: 'b', position: 0 },
        { bad: 'entry' }, // missing original/replacement
        { original: 123, replacement: {} }, // wrong types
      ],
    })
    expect(result.success).toBe(true)
    // Only the first change is valid
    expect(result.data?.changes.length).toBe(1)
  })

  it('should default position to 0 when missing', () => {
    const result = validateGrammarResult({
      corrected: 'text',
      changes: [{ original: 'x', replacement: 'y' }],
    })
    expect(result.success).toBe(true)
    expect(result.data?.changes[0].position).toBe(0)
  })
})

describe('validateOrganizeResult', () => {
  it('should accept valid organize result', () => {
    const result = validateOrganizeResult({
      suggestions: [
        { folderName: 'Work', notes: ['a.md', 'b.md'], reason: '工作相关' },
        { folderName: 'Personal', notes: ['c.md'], reason: '个人笔记' },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.suggestions.length).toBe(2)
  })

  it('should reject missing suggestions', () => {
    const result = validateOrganizeResult({ other: 'field' })
    expect(result.success).toBe(false)
  })

  it('should filter suggestions without folderName', () => {
    const result = validateOrganizeResult({
      suggestions: [
        { folderName: 'Valid', notes: ['a.md'], reason: 'ok' },
        { notes: ['b.md'], reason: 'no name' },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.suggestions.length).toBe(1)
  })
})

describe('regexFixJson', () => {
  it('should remove markdown code fences', () => {
    expect(regexFixJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('should remove trailing commas', () => {
    expect(regexFixJson('{"a":1,}')).toBe('{"a":1}')
    expect(regexFixJson('[1,2,]')).toBe('[1,2]')
  })

  it('should handle combined issues', () => {
    const input = '```json\n{"corrected":"fixed","changes":[{"x":1},]}\n```'
    const fixed = regexFixJson(input)
    expect(fixed).toBe('{"corrected":"fixed","changes":[{"x":1}]}')
  })
})

describe('sanitizeAutocompleteCompletion', () => {
  it('removes echoed context and role labels', () => {
    const result = sanitizeAutocompleteCompletion('Hello world assistant: and local AI', 'Hello world')
    expect(result).toBe('and local AI')
  })

  it('strips markdown code fences', () => {
    const result = sanitizeAutocompleteCompletion('```ts\nconst x = 1\n```')
    expect(result).toBe('const x = 1')
  })

  it('stops before new headings after an initial line', () => {
    const result = sanitizeAutocompleteCompletion('next sentence\n# New Section\nmore drift')
    expect(result).toBe('next sentence')
  })

  it('limits autocomplete to a short ghost-text sized snippet', () => {
    const result = sanitizeAutocompleteCompletion(['a', 'b', 'c', 'd'].join('\n'))
    expect(result).toBe(['a', 'b', 'c'].join('\n'))
  })
})
