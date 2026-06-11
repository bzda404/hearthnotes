/**
 * Desensitizer unit tests
 */
import { describe, it, expect } from 'vitest'
import { desensitizeSync } from 'main_renderer/ai/desensitizer'

describe('desensitizeSync', () => {
  it('should detect Chinese phone numbers', () => {
    const result = desensitizeSync('请联系我：13812345678')
    expect(result.entitiesFound.length).toBeGreaterThan(0)
    expect(result.entitiesFound.some(e => e.type === 'phone')).toBe(true)
    expect(result.masked).toContain('[PHONE]')
  })

  it('should detect Chinese ID card numbers', () => {
    // 110101 1990 01 01 1234 — 18-digit ID number
    const result = desensitizeSync('身份证号：110101199001011234')
    expect(result.entitiesFound.some(e => e.type === 'id_number')).toBe(true)
    expect(result.masked).toContain('[ID_CARD]')
  })

  it('should detect email addresses', () => {
    const result = desensitizeSync('my email is test@example.com please contact')
    expect(result.entitiesFound.some(e => e.type === 'email')).toBe(true)
    expect(result.masked).toContain('[EMAIL]')
  })

  it('should detect bank card numbers (16-digit)', () => {
    // 6222000012345678 — 16-digit bank card
    const result = desensitizeSync('卡号：6222000012345678')
    expect(result.entitiesFound.some(e => e.type === 'bank_card')).toBe(true)
    expect(result.masked).toContain('[BANK_CARD]')
  })

  it('should return empty entities for clean text', () => {
    const result = desensitizeSync('今天天气很好，适合出门散步。')
    expect(result.entitiesFound.length).toBe(0)
    expect(result.masked).toBe(result.original)
  })

  it('should mask multiple entities in one text', () => {
    const result = desensitizeSync('我的手机13812345678，邮箱test@abc.com，身份证110101199001011234')
    expect(result.entitiesFound.length).toBeGreaterThanOrEqual(3)
  })

  it('should not mask partial matches — 12 digits is not a phone number', () => {
    // 138123456789 is 12 digits — should NOT match phone (which is 11 digits)
    const result = desensitizeSync('编号138123456789')
    const phoneEntities = result.entitiesFound.filter(e => e.type === 'phone')
    expect(phoneEntities.length).toBe(0)
  })
})
