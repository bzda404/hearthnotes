/**
 * JSON Repair unit tests
 */
import { describe, it, expect } from 'vitest'
import { IncrementalJsonRepair } from 'main_renderer/ai/jsonRepair'

describe('IncrementalJsonRepair', () => {
  it('should close open brace', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"a":1')
    expect(r.snapshot()).toBe('{"a":1}')
    expect(r.tryParse()).toEqual({ a: 1 })
  })

  it('should close open array', () => {
    const r = new IncrementalJsonRepair()
    r.push('[1,2')
    expect(r.snapshot()).toBe('[1,2]')
    expect(r.tryParse()).toEqual([1, 2])
  })

  it('should close unclosed string', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"key":"value')
    expect(r.snapshot()).toBe('{"key":"value"}')
    expect(r.tryParse()).toEqual({ key: 'value' })
  })

  it('should handle nested objects', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"outer":{"inner":1')
    expect(r.snapshot()).toBe('{"outer":{"inner":1}}')
    expect(r.tryParse()).toEqual({ outer: { inner: 1 } })
  })

  it('should handle nested arrays', () => {
    const r = new IncrementalJsonRepair()
    r.push('[[1,2],[3,4')
    expect(r.snapshot()).toBe('[[1,2],[3,4]]')
    expect(r.tryParse()).toEqual([[1, 2], [3, 4]])
  })

  it('should handle mixed nesting', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"key":["a","b"')
    expect(r.snapshot()).toBe('{"key":["a","b"]}')
    expect(r.tryParse()).toEqual({ key: ['a', 'b'] })
  })

  it('should handle escaped quotes in string', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"key":"qu\\"oted"')
    expect(r.tryParse()).toEqual({ key: 'qu"oted' })
  })

  it('should return null for unparseable content', () => {
    const r = new IncrementalJsonRepair()
    r.push('not json at all {')
    const parsed = r.tryParse()
    expect(parsed).toBeNull()
  })

  it('should accept complete JSON as-is', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"done":true}')
    expect(r.tryParse()).toEqual({ done: true })
  })

  it('should reset state', () => {
    const r = new IncrementalJsonRepair()
    r.push('{"a":1')
    r.reset()
    r.push('{"b":2}')
    expect(r.tryParse()).toEqual({ b: 2 })
  })
})
