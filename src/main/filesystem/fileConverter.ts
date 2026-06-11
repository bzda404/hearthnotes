/**
 * File Converter — converts non-markdown files to .md format.
 * Uses pure JS libraries to avoid Python dependency.
 *
 * Supported formats:
 * - PDF → text extraction + markdown formatting
 * - DOCX → mammoth (DOCX→HTML) + turndown (HTML→MD)
 * - XLSX → xlsx (Excel→JSON→markdown table)
 * - HTML → turndown (HTML→MD)
 * - CSV → parse + markdown table
 * - TXT/RTF → wrap in markdown code block or plain text
 */

import { access, readFile, writeFile } from 'fs/promises'
import { basename, dirname, join, extname } from 'path'

interface ConversionResult {
  markdown: string
  outputPath: string
  originalPath: string
}

interface ConvertFileOptions {
  outputDir?: string
}

/**
 * Convert a file to markdown and save alongside the original.
 */
export async function convertFile(filePath: string, options: ConvertFileOptions = {}): Promise<ConversionResult> {
  const ext = extname(filePath).toLowerCase()
  const baseName = basename(filePath, ext)
  const dir = options.outputDir || dirname(filePath)
  const outputPath = await ensureUniqueMarkdownPath(join(dir, `${baseName}.md`))

  let markdown: string

  switch (ext) {
    case '.pdf':
      markdown = await convertPDF(filePath)
      break
    case '.docx':
    case '.doc':
      markdown = await convertDOCX(filePath)
      break
    case '.xlsx':
    case '.xls':
      markdown = await convertExcel(filePath)
      break
    case '.pptx':
    case '.ppt':
      markdown = await convertPowerPoint(filePath)
      break
    case '.html':
    case '.htm':
      markdown = await convertHTML(filePath)
      break
    case '.csv':
      markdown = await convertCSV(filePath)
      break
    case '.txt':
      markdown = await convertTXT(filePath)
      break
    case '.rtf':
    case '.odt':
    case '.epub':
      markdown = await convertGeneric(filePath)
      break
    default:
      throw new Error(`Unsupported file format: ${ext}`)
  }

  markdown = normalizeMarkdownOutput(markdown, baseName)
  await writeFile(outputPath, markdown, 'utf-8')

  return { markdown, outputPath, originalPath: filePath }
}

async function ensureUniqueMarkdownPath(preferredPath: string): Promise<string> {
  const ext = extname(preferredPath)
  const base = preferredPath.slice(0, -ext.length)
  let candidate = preferredPath
  let counter = 1
  while (await pathExists(candidate)) {
    candidate = `${base}-${counter}${ext}`
    counter++
  }
  return candidate
}

async function pathExists(pathname: string): Promise<boolean> {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}

export function escapeMarkdownTableCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim()
}

export function renderMarkdownTable(rows: unknown[][]): string {
  if (rows.length === 0) return ''
  const width = Math.max(...rows.map(row => row.length), 1)
  const normalize = (row: unknown[]): string[] => {
    const cells: string[] = []
    for (let i = 0; i < width; i++) {
      cells.push(escapeMarkdownTableCell(row[i]))
    }
    return cells
  }
  const headers = normalize(rows[0]).map((header, index) => header || `Column ${index + 1}`)
  let md = '| ' + headers.join(' | ') + ' |\n'
  md += '| ' + headers.map(() => '---').join(' | ') + ' |\n'
  for (let i = 1; i < rows.length; i++) {
    md += '| ' + normalize(rows[i] || []).join(' | ') + ' |\n'
  }
  return md
}

/**
 * PDF → Markdown via pdf-parse.
 */
async function convertPDF(filePath: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const buffer = await readFile(filePath)
  const uint8 = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise

  const title = basename(filePath, '.pdf')
  let md = `# ${title}\n\n`

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str || '')
      .join(' ')
      .trim()

    if (pageText) {
      if (doc.numPages > 1) {
        md += `## 第 ${i} 页\n\n`
      }
      md += formatText(pageText) + '\n\n'
    }
  }

  return md || `# ${title}\n\n*PDF 文件无法提取文本内容*`
}

/**
 * DOCX → Markdown via mammoth + turndown.
 */
async function convertDOCX(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const TurndownService = (await import('turndown')).default

  const buffer = await readFile(filePath)
  const result = await mammoth.convertToHtml({ buffer })
  const html = result.value

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  })

  const title = basename(filePath, extname(filePath))
  let md = `# ${title}\n\n`
  md += turndown.turndown(html)

  return md
}

/**
 * Excel → Markdown table.
 */
async function convertExcel(filePath: string): Promise<string> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.readFile(filePath)
  const title = basename(filePath, extname(filePath))
  let md = `# ${title}\n\n`

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    if (data.length === 0) continue

    md += `## ${sheetName}\n\n`

    md += renderMarkdownTable(data) + '\n'
  }

  return md
}

/**
 * PowerPoint → Markdown (text extraction).
 */
async function convertPowerPoint(filePath: string): Promise<string> {
  const JSZip = await import('jszip')
  const buffer = await readFile(filePath)
  const zip = await JSZip.default.loadAsync(buffer)

  const title = basename(filePath, extname(filePath))
  let md = `# ${title}\n\n`
  let slideNum = 0

  // Sort slide files by number
  const slideFiles = Object.keys(zip.files)
    .filter((f) => f.match(/ppt\/slides\/slide\d+\.xml/))
    .sort()

  for (const slideFile of slideFiles) {
    slideNum++
    const file = zip.files[slideFile]
    if (!file) continue
    const content = await file.async('string')
    // Extract text from XML (simple regex approach)
    const texts = content.match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
    if (texts) {
      md += `## Slide ${slideNum}\n\n`
      for (const text of texts) {
        const clean = text.replace(/<[^>]+>/g, '').trim()
        if (clean) md += `${clean}\n\n`
      }
    }
  }

  return md || `# ${title}\n\n*No text content extracted*`
}

/**
 * HTML → Markdown via turndown.
 */
async function convertHTML(filePath: string): Promise<string> {
  const TurndownService = (await import('turndown')).default
  const html = await readFile(filePath, 'utf-8')

  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  })

  const title = basename(filePath, extname(filePath))
  let md = `# ${title}\n\n`
  md += turndown.turndown(html)

  return md
}

/**
 * CSV → Markdown table.
 */
async function convertCSV(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  const lines = content.split('\n').filter((l) => l.trim())
  if (lines.length === 0) return '# Empty CSV\n'

  const title = basename(filePath, '.csv')
  let md = `# ${title}\n\n`

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  md += renderMarkdownTable(lines.map(parseCSVLine))

  return md
}

/**
 * TXT → Markdown (wrap as plain text).
 */
async function convertTXT(filePath: string): Promise<string> {
  const content = await readFile(filePath, 'utf-8')
  const title = basename(filePath, '.txt')
  return `# ${title}\n\n${content}`
}

/**
 * Generic format → attempt text extraction.
 */
async function convertGeneric(filePath: string): Promise<string> {
  // Try reading as text
  const content = await readFile(filePath, 'utf-8')
  const title = basename(filePath, extname(filePath))
  return `# ${title}\n\n${formatText(content)}`
}

/**
 * Format plain text into basic markdown structure.
 */
export function normalizeMarkdownOutput(markdown: string, fallbackTitle: string): string {
  let normalized = markdown
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[ \u00a0]+$/gm, '')
    .replace(/^\s*[•◦▪]\s+/gm, '- ')
    .replace(/^\s*[–—]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!/^#\s+\S/m.test(normalized)) {
    normalized = `# ${fallbackTitle}\n\n${normalized}`
  }

  return normalized.trimEnd() + '\n'
}

function formatText(text: string): string {
  // Clean up excessive whitespace
  const md = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n')

  // Try to detect headers (lines that are short and followed by content)
  const lines = md.split('\n')
  const formatted: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const nextLine = lines[i + 1]?.trim()

    // Short line followed by longer line might be a header
    if (line.length > 0 && line.length < 80 && !line.endsWith('.') && nextLine && nextLine.length > line.length * 2) {
      formatted.push(`### ${line}\n`)
    } else {
      formatted.push(line)
    }
  }

  return formatted.join('\n')
}
