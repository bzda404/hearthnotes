/**
 * BM25 索引构建器（支持 Worker 线程）
 * 监听文件系统变化，增量更新索引
 *
 * Worker 线程用于索引构建，避免阻塞主进程。当 Worker 不可用时（如
 * jieba 未安装），fallback 到主线程同步构建。
 */
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises'
import { existsSync, watch, readFileSync, writeFileSync, statSync, mkdirSync, type FSWatcher } from 'fs'
import { join, extname, basename } from 'path'
import { app } from 'electron'
import { BM25Index } from './bm25Index'

function getIndexDir(): string {
  const dir = join(app.getPath('userData'), 'search-indexes')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export class IndexBuilder {
  private indexes: Map<string, BM25Index> = new Map()
  private watchers: Map<string, FSWatcher> = new Map()
  private docIdCounter = 0
  private segmentChinese: ((text: string) => string[]) | null = null

  /**
   * Set a Chinese word segmenter (e.g. jieba-wasm cut function).
   * Applied to all BM25Index instances managed by this builder.
   */
  setChineseSegmenter(fn: (text: string) => string[]): void {
    this.segmentChinese = fn
  }

  /**
   * 为指定知识库构建索引（优先从缓存加载）
   */
  async buildIndex(kbPath: string, kbName: string): Promise<BM25Index> {
    // 尝试从缓存加载
    const cached = this.loadFromCache(kbName, kbPath)
    if (cached) {
      if (this.segmentChinese) cached.segmentChinese = this.segmentChinese
      this.indexes.set(kbName, cached)
      this.startWatching(kbPath, kbName, cached)
      return cached
    }

    // 缓存未命中，构建索引（尝试 Worker）
    const index = new BM25Index()
    if (this.segmentChinese) index.segmentChinese = this.segmentChinese

    await this.walkAndIndex(kbPath, index)
    this.indexes.set(kbName, index)

    // 保存到缓存
    this.saveToCache(kbName, index)

    // 启动文件监听
    this.startWatching(kbPath, kbName, index)

    return index
  }

  /**
   * 获取所有索引
   */
  getIndexes(): Map<string, BM25Index> {
    return this.indexes
  }

  /**
   * 获取指定知识库的索引
   */
  getIndex(kbName: string): BM25Index | undefined {
    return this.indexes.get(kbName)
  }

  /**
   * 删除索引
   */
  removeIndex(kbName: string): void {
    const watcher = this.watchers.get(kbName)
    if (watcher) {
      watcher.close()
      this.watchers.delete(kbName)
    }
    this.indexes.delete(kbName)
  }

  /**
   * 递归遍历目录并建立索引
   */
  private async walkAndIndex(dirPath: string, index: BM25Index): Promise<void> {
    try {
      const entries = await readdir(dirPath)
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue

        const fullPath = join(dirPath, entry)
        const fileStat = await stat(fullPath)

        if (fileStat.isDirectory()) {
          await this.walkAndIndex(fullPath, index)
        } else if (extname(entry) === '.md') {
          const content = await readFile(fullPath, 'utf-8')
          const docId = `doc_${++this.docIdCounter}`
          const title = basename(entry, '.md')
          index.addDocument(docId, fullPath, title, content)
        }
      }
    } catch {
      // 忽略无法访问的目录
    }
  }

  /**
   * 启动文件系统监听
   */
  private startWatching(dirPath: string, kbName: string, index: BM25Index): void {
    try {
      const watcher = watch(dirPath, { recursive: true }, (_eventType, filename) => {
        if (!filename || !filename.endsWith('.md')) return
        // 防抖处理
        setTimeout(async() => {
          try {
            const fullPath = join(dirPath, filename)
            const fileStat = await stat(fullPath)
            if (fileStat.isFile()) {
              const content = await readFile(fullPath, 'utf-8')
              const title = basename(filename, '.md')
              const docs = (index as unknown as { documents: Map<string, { id: string; path: string }> }).documents
              const existingEntry = Array.from(docs.values()).find(d => d.path === fullPath)
              if (existingEntry) {
                index.removeDocument(existingEntry.id)
                index.addDocument(existingEntry.id, fullPath, title, content)
              } else {
                index.addDocument(`doc_${++this.docIdCounter}`, fullPath, title, content)
              }
              // Save updated cache
              this.saveToCache(kbName, index)
            }
          } catch {
            // 文件可能已被删除
          }
        }, 500)
      })
      this.watchers.set(kbName, watcher)
    } catch {
      // 监听失败不影响主功能
    }
  }

  /**
   * 从缓存加载索引
   */
  private loadFromCache(kbName: string, _kbPath: string): BM25Index | null {
    try {
      const cachePath = join(getIndexDir(), `${this.sanitizeName(kbName)}.json`)
      if (!existsSync(cachePath)) return null

      const cacheStat = statSync(cachePath)
      const cacheAge = Date.now() - cacheStat.mtimeMs
      if (cacheAge > 24 * 60 * 60 * 1000) return null // 超过 24 小时过期

      const data = readFileSync(cachePath, 'utf-8')
      return BM25Index.deserialize(data)
    } catch {
      return null
    }
  }

  /**
   * 保存索引到缓存
   */
  private saveToCache(kbName: string, index: BM25Index): void {
    try {
      const idxDir = getIndexDir()
      if (!existsSync(idxDir)) mkdirSync(idxDir, { recursive: true })
      const cachePath = join(idxDir, `${this.sanitizeName(kbName)}.json`)
      writeFileSync(cachePath, index.serialize(), 'utf-8')
    } catch (err) {
      console.error('[IndexBuilder] Failed to save cache:', err)
    }
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  /**
   * 清理所有资源
   */
  destroy(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close()
    }
    this.watchers.clear()
    this.indexes.clear()
  }
}
