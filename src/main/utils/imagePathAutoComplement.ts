import fsPromises from 'fs/promises'
import { watch as fsWatch, type FSWatcher } from 'fs'
import path from 'path'
import { filter } from 'fuzzaldrin'
import log from 'electron-log'
import { isDirectory, isFile } from 'common/filesystem'
import { IMAGE_EXTENSIONS } from 'common/filesystem/paths'
import { BLACK_LIST } from '../config'

// Refactored: uses fs.promises, LRU-limited cache, and lifecycle-managed watchers.

interface DirOrImageEntry {
  file: string
  type: string
}

const IMAGE_REG = new RegExp('(' + IMAGE_EXTENSIONS.join('|') + ')$', 'i')
const MAX_CACHE_ENTRIES = 50

const IMAGE_PATH: Map<string, DirOrImageEntry[]> = new Map()
export const watchers: Map<string, FSWatcher> = new Map()

function filesHandler(
  files: string[],
  directory: string,
  key?: string
): DirOrImageEntry[] | undefined {
  const onlyDirAndImage: DirOrImageEntry[] = files
    .map((file): DirOrImageEntry => {
      const fullPath = path.join(directory, file)
      let type = ''
      if (isDirectory(fullPath)) {
        type = 'directory'
      } else if (isFile(fullPath) && IMAGE_REG.test(file)) {
        type = 'image'
      }
      return { file, type }
    })
    .filter(({ file, type }) => {
      if ((BLACK_LIST as readonly string[]).includes(file)) return false
      return type === 'directory' || type === 'image'
    })

  // LRU eviction: remove oldest entry if at capacity
  if (IMAGE_PATH.size >= MAX_CACHE_ENTRIES) {
    const firstKey = IMAGE_PATH.keys().next().value
    if (firstKey) IMAGE_PATH.delete(firstKey)
  }

  IMAGE_PATH.set(directory, onlyDirAndImage)
  if (key !== undefined) {
    return filter(onlyDirAndImage, key, { key: 'file' })
  }
  return undefined
}

async function rebuild(directory: string): Promise<void> {
  try {
    const files = await fsPromises.readdir(directory)
    filesHandler(files, directory)
  } catch (err) {
    log.error('imagePathAutoComplement::rebuild:', err)
  }
}

function watchDirectory(directory: string): void {
  if (watchers.has(directory)) return
  try {
    const watcher = fsWatch(directory, (_eventType, _filename) => {
      rebuild(directory).catch(() => {
        // ignore
      })
    })
    watchers.set(directory, watcher)
  } catch {
    // Watching may fail on some platforms — degrade gracefully
  }
}

/**
 * Remove a directory watcher and its cached entry.
 */
export function unwatchDirectory(directory: string): void {
  const watcher = watchers.get(directory)
  if (watcher) {
    watcher.close()
    watchers.delete(directory)
  }
  IMAGE_PATH.delete(directory)
}

/**
 * Clean up all watchers and cached entries.
 */
export function cleanupAllWatchers(): void {
  for (const [, watcher] of watchers) {
    try { watcher.close() } catch { /* ignore */ }
  }
  watchers.clear()
  IMAGE_PATH.clear()
}

export async function searchFilesAndDir(directory: string, key: string): Promise<DirOrImageEntry[]> {
  if (IMAGE_PATH.has(directory)) {
    return filter(IMAGE_PATH.get(directory) || [], key, { key: 'file' })
  }
  const files = await fsPromises.readdir(directory)
  const result = filesHandler(files, directory, key) ?? []
  watchDirectory(directory)
  return result
}
