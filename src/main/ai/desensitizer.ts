/**
 * Desensitizer — masks PII entities in text for privacy preview.
 * Uses the local AI model for NER when available, falls back to regex patterns.
 */
import { modelHubClient } from './modelHubClient'
import type { PIIEntity, DesensitizedPreview } from '@shared/types/mcpTypes'

// Regex patterns for common Chinese and international PII
const PII_PATTERNS: Array<{ type: PIIEntity['type']; pattern: RegExp }> = [
  // Email addresses (match before numbers to avoid false positives)
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  // Chinese ID card numbers (18 digits) — must match before bank_card to avoid overlap
  { type: 'id_number', pattern: /(?<!\d)[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g },
  // Bank card numbers (16-19 digits)
  { type: 'bank_card', pattern: /(?<!\d)[36]\d{3}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?:[-\s]?\d{1,3})?(?!\d)/g },
  // Chinese mobile phone numbers (11 digits, starts with 1[3-9])
  { type: 'phone', pattern: /(?<!\d)1[3-9]\d{9}(?!\d)/g },
]

const MASK_LABELS: Record<PIIEntity['type'], string> = {
  phone: '[PHONE]',
  id_number: '[ID_CARD]',
  email: '[EMAIL]',
  name: '[NAME]',
  address: '[ADDRESS]',
  bank_card: '[BANK_CARD]',
  other: '[PII]',
}

/**
 * Detect PII entities using regex patterns (fallback when model is offline).
 */
function detectWithRegex(text: string): PIIEntity[] {
  const entities: PIIEntity[] = []

  for (const { type, pattern } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags)
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) !== null) {
      entities.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      })
    }
  }

  // Sort by position, remove overlapping matches (keep the first)
  entities.sort((a, b) => a.start - b.start)
  const filtered: PIIEntity[] = []
  let lastEnd = -1
  for (const entity of entities) {
    if (entity.start >= lastEnd) {
      filtered.push(entity)
      lastEnd = entity.end
    }
  }

  return filtered
}

/**
 * Detect PII entities using the local AI model for NER.
 */
async function detectWithModel(text: string): Promise<PIIEntity[]> {
  // Try AinCore for NER, fall back to regex
  try {
    const available = await modelHubClient.discover()
    if (!available) return detectWithRegex(text)

    const SYSTEM_PROMPT = `You are a PII detection engine. Identify ALL personally identifiable information in the given text. Output ONLY valid JSON, no explanation:
{"entities": [{"type": "phone|id_number|email|name|address|bank_card|other", "value": "the entity text", "start": 0, "end": 0}]}
Types: phone (phone numbers), id_number (ID/passport numbers), email (email addresses), name (person names), address (physical addresses), bank_card (bank card numbers), other (other PII).
Start and end are character offsets in the original text. Be thorough - find ALL PII.`

    const raw = await modelHubClient.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 1000) },
      ],
      max_tokens: 512,
      temperature: 0,
    })

    // Parse and validate
    let cleaned = raw.trim()
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

    const parsed = JSON.parse(cleaned) as { entities: PIIEntity[] }
    if (Array.isArray(parsed.entities)) {
      return parsed.entities.filter(
        (e) => e.type && typeof e.start === 'number' && typeof e.end === 'number'
      )
    }

    return detectWithRegex(text)
  } catch {
    // Fall back to regex on any error
    return detectWithRegex(text)
  }
}

/**
 * Mask PII entities in the text.
 */
function maskEntities(text: string, entities: PIIEntity[]): string {
  // Process from end to start to preserve offsets
  const sorted = [...entities].sort((a, b) => b.start - a.start)
  let masked = text
  for (const entity of sorted) {
    const label = MASK_LABELS[entity.type] || '[PII]'
    masked = masked.slice(0, entity.start) + label + masked.slice(entity.end)
  }
  return masked
}

/**
 * Desensitize text for privacy preview.
 * Uses AI model when available, falls back to regex.
 */
export async function desensitize(text: string): Promise<DesensitizedPreview> {
  const entities = await detectWithModel(text)
  const masked = maskEntities(text, entities)

  return {
    original: text,
    masked,
    entitiesFound: entities,
  }
}

/**
 * Desensitize text using regex only (no model dependency).
 * Used when the AI sidecar is not running.
 */
export function desensitizeSync(text: string): DesensitizedPreview {
  const entities = detectWithRegex(text)
  const masked = maskEntities(text, entities)

  return {
    original: text,
    masked,
    entitiesFound: entities,
  }
}
