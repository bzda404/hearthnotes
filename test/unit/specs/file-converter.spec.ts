import { mkdtemp, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import {
  convertFile,
  normalizeMarkdownOutput,
  renderMarkdownTable,
} from 'main_renderer/filesystem/fileConverter'

describe('fileConverter', () => {
  it('writes converted markdown into the knowledge base output directory', async() => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'mindvault-source-'))
    const kbDir = await mkdtemp(join(tmpdir(), 'mindvault-kb-'))
    const source = join(sourceDir, 'Research Log.txt')
    await writeFile(source, 'privacy first\nlocal AI', 'utf-8')

    const result = await convertFile(source, { outputDir: kbDir })

    expect(result.outputPath).toBe(join(kbDir, 'Research Log.md'))
    await expect(readFile(result.outputPath, 'utf-8')).resolves.toContain('# Research Log')
  })

  it('does not overwrite an existing markdown note in the output directory', async() => {
    const sourceDir = await mkdtemp(join(tmpdir(), 'mindvault-source-'))
    const kbDir = await mkdtemp(join(tmpdir(), 'mindvault-kb-'))
    const source = join(sourceDir, 'Report.txt')
    await writeFile(source, 'new report', 'utf-8')
    await writeFile(join(kbDir, 'Report.md'), '# Existing\n', 'utf-8')

    const result = await convertFile(source, { outputDir: kbDir })

    expect(result.outputPath).toBe(join(kbDir, 'Report-1.md'))
    await expect(readFile(join(kbDir, 'Report.md'), 'utf-8')).resolves.toBe('# Existing\n')
  })

  it('renders CSV with quoted commas and markdown table escaping', async() => {
    const dir = await mkdtemp(join(tmpdir(), 'mindvault-csv-'))
    const source = join(dir, 'Audit.csv')
    await writeFile(source, 'Name,Note\n"Alice, Inc","risk | high"\nBob,"ok"', 'utf-8')

    const result = await convertFile(source)
    const markdown = await readFile(result.outputPath, 'utf-8')

    expect(markdown).toContain('| Name | Note |')
    expect(markdown).toContain('| Alice, Inc | risk \\| high |')
    expect(markdown).toContain('| Bob | ok |')
  })

  it('normalizes markdown output for clean ingestion', () => {
    const markdown = normalizeMarkdownOutput('• first\n– second\n\n\nplain', 'Inbox')

    expect(markdown).toBe('# Inbox\n\n- first\n- second\n\nplain\n')
  })

  it('fills blank table headers with stable column names', () => {
    const markdown = renderMarkdownTable([
      ['', 'Amount'],
      ['Alice', '100'],
    ])

    expect(markdown).toContain('| Column 1 | Amount |')
    expect(markdown).toContain('| Alice | 100 |')
  })

  it('applies markdown cleanup to converted text files', async() => {
    const dir = await mkdtemp(join(tmpdir(), 'mindvault-txt-'))
    const source = join(dir, 'Loose.txt')
    await writeFile(source, '• alpha\n\n\n– beta   ', 'utf-8')

    const result = await convertFile(source)
    const markdown = await readFile(result.outputPath, 'utf-8')

    expect(markdown).toBe('# Loose\n- alpha\n- beta\n')
  })
})
