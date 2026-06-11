/**
 * MCP Handlers unit tests
 */
import { mkdtemp, mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import {
  clearKnowledgeBasePath,
  getKnowledgeBasePath,
  setKnowledgeBasePath,
  handleListNotes,
  handleReadNote,
  handleSearchNotes,
} from 'main_renderer/mcp/handlers'
import { resetMCPTelemetry } from 'main_renderer/mcp/telemetry'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/aincore-test'),
  },
}))

describe('MCP Handlers', () => {
  beforeEach(() => {
    clearKnowledgeBasePath()
    resetMCPTelemetry()
  })

  it('should return error when no knowledge base path is set', async() => {
    const result = await handleSearchNotes({ query: 'test' }, 'test-client')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('No knowledge base opened')
  })

  it('should search markdown notes after setting a knowledge base path', async() => {
    const root = await mkdtemp(join(tmpdir(), 'aincore-kb-'))
    const notePath = join(root, 'note.md')
    await writeFile(notePath, 'Local AI notes mention vector search and MCP.', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleSearchNotes({ query: 'vector search' }, 'test-client')
    const payload = JSON.parse(result.content[0].text) as Array<{ path: string; title: string }>

    expect(result.isError).not.toBe(true)
    expect(payload).toHaveLength(1)
    expect(payload[0].path).toBe(notePath)
    expect(payload[0].title).toBe('note')
    expect(getKnowledgeBasePath()).toBe(root)
    const { getMCPTelemetry } = await import('main_renderer/mcp/telemetry')
    expect(getMCPTelemetry().rag).toMatchObject({
      lastQuery: 'vector search',
      lastHitCount: 1,
    })
  })

  it('should build and use the shared BM25 search index for MCP search', async() => {
    const root = await mkdtemp(join(tmpdir(), 'aincore-kb-'))
    await writeFile(join(root, 'alpha.md'), 'privacy local model security sentinel', 'utf-8')
    await writeFile(join(root, 'beta.md'), 'unrelated grocery list', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleSearchNotes({ query: 'security sentinel' }, 'test-client')
    const payload = JSON.parse(result.content[0].text) as Array<{ path: string; title: string }>

    expect(result.isError).not.toBe(true)
    expect(payload[0].title).toBe('alpha')
  })

  it('should reject reads outside the knowledge base', async() => {
    const root = await mkdtemp(join(tmpdir(), 'aincore-kb-'))
    const outside = await mkdtemp(join(tmpdir(), 'aincore-outside-'))
    const outsideNote = join(outside, 'secret.md')
    await writeFile(outsideNote, 'secret', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleReadNote({ path: outsideNote }, 'test-client')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('outside the knowledge base')
  })

  it('should reject paths in sibling directories with the same prefix', async() => {
    const parent = await mkdtemp(join(tmpdir(), 'aincore-prefix-'))
    const root = join(parent, 'notes')
    const sibling = join(parent, 'notes-private')
    await mkdir(root)
    await mkdir(sibling)

    const siblingNote = join(sibling, 'secret.md')
    await writeFile(siblingNote, 'secret', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleReadNote({ path: siblingNote }, 'test-client')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('outside the knowledge base')
  })

  it('should reject list_notes paths that escape the knowledge base', async() => {
    const parent = await mkdtemp(join(tmpdir(), 'aincore-list-'))
    const root = join(parent, 'notes')
    const sibling = join(parent, 'notes-private')
    await mkdir(root)
    await mkdir(sibling)
    await writeFile(join(sibling, 'secret.md'), 'secret', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleListNotes({ kb: '../notes-private' }, 'test-client')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('outside the knowledge base')
  })

  it('should reject search_notes paths that escape the knowledge base', async() => {
    const parent = await mkdtemp(join(tmpdir(), 'aincore-search-'))
    const root = join(parent, 'notes')
    const sibling = join(parent, 'notes-private')
    await mkdir(root)
    await mkdir(sibling)
    await writeFile(join(sibling, 'secret.md'), 'secret keyword', 'utf-8')

    setKnowledgeBasePath(root)
    const result = await handleSearchNotes({ query: 'secret', kb: '../notes-private' }, 'test-client')

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('outside the knowledge base')
  })
})
