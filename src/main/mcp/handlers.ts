/**
 * MCP Tool / Resource handlers — pure logic, no transport.
 * Extracted from the old monolithic server.ts so the new
 * stdio-only server.ts can import them cleanly.
 */
import { readFile, writeFile, readdir, stat } from 'fs/promises'
import { join, basename, extname, resolve, relative, isAbsolute } from 'path'
import { buildKnowledgeBaseIndex, searchKnowledgeBases } from '../search'
import { getLastRerankTelemetry } from '../search/reranker'
import { recordRagTelemetry } from './telemetry'
import type { MCPToolResult, NoteSearchResult, NoteListItem } from '@shared/types/mcpTypes'

let knowledgeBasePath: string | null = null

/**
 * Set the knowledge base root path.
 */
export function setKnowledgeBasePath(path: string): void {
  knowledgeBasePath = resolve(path)
}

export function clearKnowledgeBasePath(): void {
  knowledgeBasePath = null
}

/**
 * Get the knowledge base root path.
 */
export function getKnowledgeBasePath(): string | null {
  return knowledgeBasePath
}

function isPathInsideKnowledgeBase(filePath: string): boolean {
  if (!knowledgeBasePath) return false
  const resolvedRoot = resolve(knowledgeBasePath)
  const resolvedPath = resolve(filePath)
  const rel = relative(resolvedRoot, resolvedPath)
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
}

function resolveInsideKnowledgeBase(pathname: string): string | null {
  if (!knowledgeBasePath) return null
  const resolvedPath = resolve(pathname)
  return isPathInsideKnowledgeBase(resolvedPath) ? resolvedPath : null
}

function resolveKnowledgeBaseChild(pathname: string = ''): string | null {
  if (!knowledgeBasePath) return null
  return resolveInsideKnowledgeBase(join(knowledgeBasePath, pathname))
}

function countOccurrences(content: string, query: string): number {
  if (!query) return 0
  let count = 0
  let index = 0
  while (true) {
    const found = content.indexOf(query, index)
    if (found === -1) break
    count++
    index = found + query.length
  }
  return count
}

// ============================================================
// Tool handlers
// ============================================================

/**
 * search_notes — Full-text search across the knowledge base.
 */
export async function handleSearchNotes(
  args: Record<string, unknown>,
  _clientName: string = 'unknown'
): Promise<MCPToolResult> {
  const query = String(args.query || '')
  const kb = args.kb ? String(args.kb) : undefined
  const limit = typeof args.limit === 'number' ? args.limit : 20

  if (!knowledgeBasePath) {
    recordRagTelemetry({
      lastQuery: query,
      lastHitCount: 0,
      lastRerankUsedCore: false,
      lastRerankAttempted: 0,
      lastRerankSucceeded: 0,
      lastRerankFailed: 0,
    })
    return { content: [{ type: 'text', text: 'No knowledge base opened' }], isError: true }
  }

  const searchRoot = resolveKnowledgeBaseChild(kb || '')
  if (!searchRoot) {
    return { content: [{ type: 'text', text: 'Path is outside the knowledge base' }], isError: true }
  }

  const kbName = kb || basename(knowledgeBasePath)
  let results = await searchKnowledgeBases(query, kb, limit, true)
  if (results.length === 0) {
    await buildKnowledgeBaseIndex(searchRoot, kbName)
    results = await searchKnowledgeBases(query, kb, limit, true)
  }

  const normalizedResults = results.length > 0
    ? results.map(result => ({
      path: result.path,
      title: result.title,
      snippet: result.snippet,
      matchCount: 1,
      score: result.score,
    }))
    : await searchInDirectory(
      searchRoot,
      query,
      limit
    )
  const rerankTelemetry = getLastRerankTelemetry()
  recordRagTelemetry({
    lastQuery: query,
    lastHitCount: normalizedResults.length,
    lastRerankUsedCore: rerankTelemetry.usedCore,
    lastRerankAttempted: rerankTelemetry.attempted,
    lastRerankSucceeded: rerankTelemetry.succeeded,
    lastRerankFailed: rerankTelemetry.failed,
  })

  return {
    content: [{ type: 'text', text: JSON.stringify(normalizedResults, null, 2) }],
  }
}

/**
 * read_note — Read a note's content.
 */
export async function handleReadNote(
  args: Record<string, unknown>,
  _clientName: string = 'unknown'
): Promise<MCPToolResult> {
  const filePath = String(args.path || '')
  const safePath = resolveInsideKnowledgeBase(filePath)

  // Security: ensure the path is within the knowledge base
  if (!safePath) {
    return { content: [{ type: 'text', text: 'Path is outside the knowledge base' }], isError: true }
  }

  try {
    const content = await readFile(safePath, 'utf-8')
    const fileStat = await stat(safePath)
    const metadata = {
      title: basename(safePath, extname(safePath)),
      size: fileStat.size,
      lastModified: fileStat.mtime.toISOString(),
    }
    return {
      content: [{ type: 'text', text: JSON.stringify({ content, metadata }, null, 2) }],
    }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error reading file: ${err}` }], isError: true }
  }
}

/**
 * list_notes — List notes in a knowledge base folder.
 */
export async function handleListNotes(
  args: Record<string, unknown>,
  _clientName: string = 'unknown'
): Promise<MCPToolResult> {
  const kb = String(args.kb || '')
  const recursive = typeof args.recursive === 'boolean' ? args.recursive : false

  if (!knowledgeBasePath) {
    return { content: [{ type: 'text', text: 'No knowledge base opened' }], isError: true }
  }

  const dirPath = resolveKnowledgeBaseChild(kb)
  if (!dirPath) {
    return { content: [{ type: 'text', text: 'Path is outside the knowledge base' }], isError: true }
  }

  const notes = await listNotesInDir(dirPath, recursive)

  return {
    content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }],
  }
}

/**
 * write_note — Write/create a note.
 */
export async function handleWriteNote(
  args: Record<string, unknown>,
  _clientName: string = 'unknown'
): Promise<MCPToolResult> {
  const filePath = String(args.path || '')
  const content = String(args.content || '')
  const safePath = resolveInsideKnowledgeBase(filePath)

  if (!safePath) {
    return { content: [{ type: 'text', text: 'Path is outside the knowledge base' }], isError: true }
  }

  try {
    await writeFile(safePath, content, 'utf-8')
    return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error writing file: ${err}` }], isError: true }
  }
}

/**
 * get_context — Get surrounding context for a note.
 */
export async function handleGetContext(
  args: Record<string, unknown>,
  _clientName: string = 'unknown'
): Promise<MCPToolResult> {
  const filePath = String(args.path || '')
  const range = Array.isArray(args.range) ? args.range as [number, number] : undefined
  const safePath = resolveInsideKnowledgeBase(filePath)

  if (!safePath) {
    return { content: [{ type: 'text', text: 'Path is outside the knowledge base' }], isError: true }
  }

  try {
    const content = await readFile(safePath, 'utf-8')
    const lines = content.split('\n')

    if (range) {
      const [start, end] = range
      const context = lines.slice(Math.max(0, start - 1), end).join('\n')
      return { content: [{ type: 'text', text: context }] }
    }

    // Default: return first 50 lines
    const context = lines.slice(0, 50).join('\n')
    return { content: [{ type: 'text', text: context }] }
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err}` }], isError: true }
  }
}

// ============================================================
// Resource handlers
// ============================================================

/**
 * note:// resource — read a specific note by path.
 */
export async function handleNoteResource(uri: string): Promise<string> {
  const relativePath = uri.replace('note://', '')
  if (!knowledgeBasePath) throw new Error('No knowledge base opened')

  const fullPath = join(knowledgeBasePath, relativePath)
  const safePath = resolveInsideKnowledgeBase(fullPath)
  if (!safePath) throw new Error('Path outside knowledge base')

  return readFile(safePath, 'utf-8')
}

/**
 * kb:// resource — list notes in a knowledge base.
 */
export async function handleKBResource(uri: string): Promise<string> {
  const kbName = uri.replace('kb://', '')
  if (!knowledgeBasePath) throw new Error('No knowledge base opened')

  const dirPath = resolveKnowledgeBaseChild(kbName)
  if (!dirPath) throw new Error('Path outside knowledge base')

  const notes = await listNotesInDir(dirPath, true)
  return JSON.stringify(notes, null, 2)
}

// ============================================================
// Internal helpers
// ============================================================

async function searchInDirectory(
  dirPath: string,
  query: string,
  limit: number
): Promise<NoteSearchResult[]> {
  const results: NoteSearchResult[] = []
  const queryLower = query.toLowerCase()

  async function walk(dir: string): Promise<void> {
    if (results.length >= limit) return

    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        if (results.length >= limit) return
        if (entry.startsWith('.')) continue

        const fullPath = join(dir, entry)
        const fileStat = await stat(fullPath)

        if (fileStat.isDirectory()) {
          await walk(fullPath)
        } else if (entry.endsWith('.md')) {
          const content = await readFile(fullPath, 'utf-8')
          const contentLower = content.toLowerCase()
          const matchCount = countOccurrences(contentLower, queryLower)

          if (matchCount > 0) {
            const idx = contentLower.indexOf(queryLower)
            const snippetStart = Math.max(0, idx - 50)
            const snippetEnd = Math.min(content.length, idx + query.length + 50)

            results.push({
              path: fullPath,
              title: basename(entry, '.md'),
              snippet: content.slice(snippetStart, snippetEnd),
              matchCount,
              score: matchCount / (content.length / 1000),
            })
          }
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dirPath)
  return results.sort((a, b) => b.score - a.score)
}

async function listNotesInDir(dirPath: string, recursive: boolean): Promise<NoteListItem[]> {
  const notes: NoteListItem[] = []

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        if (entry.startsWith('.')) continue

        const fullPath = join(dir, entry)
        const fileStat = await stat(fullPath)

        if (fileStat.isDirectory()) {
          notes.push({
            path: fullPath,
            title: entry,
            size: 0,
            lastModified: fileStat.mtime.toISOString(),
            isDirectory: true,
          })
          if (recursive) await walk(fullPath)
        } else if (entry.endsWith('.md')) {
          notes.push({
            path: fullPath,
            title: basename(entry, '.md'),
            size: fileStat.size,
            lastModified: fileStat.mtime.toISOString(),
            isDirectory: false,
          })
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dirPath)
  return notes
}
