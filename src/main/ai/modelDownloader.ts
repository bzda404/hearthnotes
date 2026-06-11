/**
 * 模型下载器 — 从 hf-mirror.com 流式下载 GGUF 文件
 * 支持进度回调、下载完成自动注册、取消下载
 */
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'

let activeAbortController: AbortController | null = null

interface DownloadOptions {
  name: string
  url: string
  quantization: string
  size: string
}

interface DownloadProgress {
  percent: number
  downloadedBytes: number
  totalBytes: number
  speed: number
  status: 'downloading' | 'done' | 'error'
  error?: string
}

function getModelDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/**
 * 下载模型文件
 */
export async function downloadModelFile(
  options: DownloadOptions,
  onProgress: (progress: DownloadProgress) => void
): Promise<string> {
  const destPath = join(getModelDir(), options.name)

  // 检查是否已存在
  if (existsSync(destPath)) {
    const stat = statSync(destPath)
    if (stat.size > 100 * 1024 * 1024) { // > 100MB 认为有效
      onProgress({ percent: 100, downloadedBytes: stat.size, totalBytes: stat.size, speed: 0, status: 'done' })
      return destPath
    }
  }

  // 构建下载 URL
  let downloadUrl = options.url
  if (downloadUrl.startsWith('hf://')) {
    // hf://org/model → https://hf-mirror.com/org/model/resolve/main/file.gguf
    const parts = downloadUrl.replace('hf://', '').split('/')
    const org = parts[0]
    const model = parts[1]
    downloadUrl = `https://hf-mirror.com/${org}/${model}/resolve/main/${options.name}`
  } else if (downloadUrl.startsWith('modelscope://')) {
    // modelscope://org/model → https://modelscope.cn/models/org/model/resolve/master/file.gguf
    const parts = downloadUrl.replace('modelscope://', '').split('/')
    const org = parts[0]
    const model = parts[1]
    downloadUrl = `https://modelscope.cn/models/${org}/${model}/resolve/master/${options.name}`
  }

  // 发起下载
  activeAbortController = new AbortController()
  const response = await fetch(downloadUrl, {
    signal: activeAbortController.signal,
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`下载失败: HTTP ${response.status}`)
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10)
  let downloadedBytes = 0
  let lastTime = Date.now()
  let lastBytes = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeStream = Readable.fromWeb(response.body as any)
  const writeStream = createWriteStream(destPath)

  // 进度追踪
  const { Transform } = await import('stream')
  const progressStream = new Transform({
    transform(chunk: Buffer, _encoding: string, callback: (err?: Error | null, data?: Buffer) => void) {
      downloadedBytes += chunk.length

      const now = Date.now()
      if (now - lastTime >= 500) {
        const elapsed = (now - lastTime) / 1000
        const speed = (downloadedBytes - lastBytes) / elapsed
        lastTime = now
        lastBytes = downloadedBytes

        onProgress({
          percent: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
          downloadedBytes,
          totalBytes,
          speed,
          status: 'downloading',
        })
      }

      callback(null, chunk)
    },
  })

  try {
    await pipeline(nodeStream, progressStream, writeStream)
  } catch (err) {
    onProgress({ percent: 0, downloadedBytes: 0, totalBytes: 0, speed: 0, status: 'error', error: String(err) })
    throw err
  }

  // 完成
  const finalStat = statSync(destPath)
  onProgress({ percent: 100, downloadedBytes: finalStat.size, totalBytes: finalStat.size, speed: 0, status: 'done' })

  return destPath
}

/**
 * 取消当前下载
 */
export function cancelDownload(): void {
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

/**
 * 删除模型文件
 */
export function deleteModelFile(filePath: string): boolean {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath)
      return true
    }
    return false
  } catch {
    return false
  }
}
