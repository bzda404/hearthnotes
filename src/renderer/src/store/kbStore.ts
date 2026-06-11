/**
 * Knowledge Base Pinia store — manages the file tree sidebar state.
 * Each top-level folder is a "knowledge base".
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NoteMeta } from '@shared/types/aiTypes'

export interface KBFileNode {
  name: string
  path: string
  isDirectory: boolean
  children: KBFileNode[]
  expanded: boolean
  size?: number
  lastModified?: string
}

export const useKBStore = defineStore('kb', () => {
  // ---- State ----
  const rootPath = ref<string | null>(null)
  const tree = ref<KBFileNode[]>([])
  const selectedPath = ref<string | null>(null)
  const searchQuery = ref('')
  const searchResults = ref<Array<{ path: string; snippet: string }>>([])

  // ---- Getters ----
  const knowledgeBases = computed(() => tree.value.filter((n) => n.isDirectory))
  const hasRoot = computed(() => !!rootPath.value)
  const selectedNode = computed(() => findNodeByPath(tree.value, selectedPath.value))

  // ---- Actions ----

  async function setRootPath(path: string): Promise<void> {
    rootPath.value = path
    await refreshTree()
    startWatching()
    await window.mcp.setKnowledgeBase(path)
    // 构建 BM25 搜索索引
    try {
      await window.electron.ipcRenderer.invoke('mt::search::build-index', path, path.split('/').pop() || 'default')
    } catch {
      // 索引构建失败不影响主功能
    }
  }

  async function refreshTree(): Promise<void> {
    if (!rootPath.value) return
    tree.value = await buildTree(rootPath.value)
  }

  function toggleExpand(node: KBFileNode): void {
    node.expanded = !node.expanded
  }

  function selectNode(path: string): void {
    selectedPath.value = path
  }

  async function search(query: string): Promise<void> {
    searchQuery.value = query
    if (!query.trim()) {
      searchResults.value = []
      return
    }
    try {
      // 优先使用 BM25 搜索（通过 IPC）
      const results = await window.electron.ipcRenderer.invoke('mt::search::bm25', query, undefined) as Array<{ path: string; title: string; snippet: string; score: number }>
      searchResults.value = results.map(r => ({ path: r.path, snippet: r.snippet }))
    } catch {
      // 降级到 ripgrep
      try {
        const results = await performSearch(query, rootPath.value || '')
        searchResults.value = results
      } catch (err) {
        console.error('[KB Store] Search failed:', err)
        searchResults.value = []
      }
    }
  }

  async function createNote(parentPath: string, name: string): Promise<string> {
    const ext = name.endsWith('.md') ? '' : '.md'
    const fullPath = `${parentPath}/${name}${ext}`
    await window.fileUtils.outputFile(fullPath, `# ${name.replace(/\.md$/, '')}\n\n`)
    await refreshTree()
    return fullPath
  }

  async function createFolder(parentPath: string, name: string): Promise<string> {
    const fullPath = `${parentPath}/${name}`
    await window.fileUtils.ensureDir(fullPath)
    await refreshTree()
    return fullPath
  }

  async function deleteNode(path: string): Promise<void> {
    await window.fileUtils.unlink(path)
    if (selectedPath.value === path) selectedPath.value = null
    await refreshTree()
  }

  async function renameNode(oldPath: string, newName: string): Promise<string> {
    const dir = window.path.dirname(oldPath)
    const newPath = window.path.join(dir, newName)
    await window.fileUtils.move(oldPath, newPath)
    if (selectedPath.value === oldPath) selectedPath.value = newPath
    await refreshTree()
    return newPath
  }

  /**
   * Get note metadata for AI organization suggestions.
   */
  async function getNotesForOrganization(): Promise<NoteMeta[]> {
    const notes: NoteMeta[] = []
    for (const node of tree.value) {
      if (node.isDirectory) {
        await collectNotes(node, notes)
      }
    }
    return notes
  }

  /**
   * 监听文件系统变化（MarkText 已有的 watcher 事件）
   */
  let refreshDebounce: ReturnType<typeof setTimeout> | null = null

  function startWatching(): void {
    window.electron.ipcRenderer.on('mt::update-file', (_e: unknown, payload: unknown) => {
      const detail = payload as { type?: string; change?: { pathname?: string } }
      if (!rootPath.value || !detail?.change?.pathname) return
      // 只处理知识库目录下的文件变化
      if (!detail.change.pathname.startsWith(rootPath.value)) return
      // 防抖刷新（500ms）
      if (refreshDebounce) clearTimeout(refreshDebounce)
      refreshDebounce = setTimeout(() => { refreshTree() }, 500)
    })
  }

  function stopWatching(): void {
    if (refreshDebounce) clearTimeout(refreshDebounce)
    window.electron.ipcRenderer.removeAllListeners('mt::update-file')
  }

  // ---- Listeners ----
  // File system changes are handled by startWatching() which listens to
  // mt::update-file IPC events from the main process watcher.

  return {
    // State
    rootPath,
    tree,
    selectedPath,
    searchQuery,
    searchResults,
    // Getters
    knowledgeBases,
    hasRoot,
    selectedNode,
    // Actions
    setRootPath,
    refreshTree,
    toggleExpand,
    selectNode,
    search,
    createNote,
    createFolder,
    deleteNode,
    renameNode,
    getNotesForOrganization,
    startWatching,
    stopWatching,
  }
})

// ---- Internal helpers ----

async function buildTree(dirPath: string, depth: number = 0): Promise<KBFileNode[]> {
  if (depth > 10) return [] // prevent infinite recursion

  const entries = await window.fileUtils.readdir(dirPath)
  const nodes: KBFileNode[] = []

  for (const name of entries.sort()) {
    // Skip hidden files and common non-content dirs
    if (name.startsWith('.') || name === 'node_modules' || name === '__pycache__') continue

    const fullPath = `${dirPath}/${name}`
    const isDir = await window.fileUtils.isDirectory(fullPath)

    const node: KBFileNode = {
      name,
      path: fullPath,
      isDirectory: isDir,
      children: [],
      expanded: false,
    }

    if (isDir) {
      node.children = await buildTree(fullPath, depth + 1)
    } else {
      const stat = await window.fileUtils.stat(fullPath)
      node.size = stat.size
      node.lastModified = String(stat.mtimeMs)
    }

    nodes.push(node)
  }

  return nodes
}

function findNodeByPath(nodes: KBFileNode[], path: string | null): KBFileNode | null {
  if (!path) return null
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.isDirectory) {
      const found = findNodeByPath(node.children, path)
      if (found) return found
    }
  }
  return null
}

async function collectNotes(node: KBFileNode, notes: NoteMeta[]): Promise<void> {
  for (const child of node.children) {
    if (child.isDirectory) {
      await collectNotes(child, notes)
    } else if (child.name.endsWith('.md')) {
      try {
        const content = await window.fileUtils.readFile(child.path, 'utf-8') as string
        notes.push({
          path: child.path,
          title: child.name.replace(/\.md$/, ''),
          snippet: content.slice(0, 200),
          currentFolder: node.name,
        })
      } catch {
        // Skip unreadable files
      }
    }
  }
}

async function performSearch(query: string, rootPath: string): Promise<Array<{ path: string; snippet: string }>> {
  if (!rootPath) return []

  return new Promise((resolve, reject) => {
    const results: Array<{ path: string; snippet: string }> = []
    const searchId = crypto.randomUUID()

    const unsubMatch = window.ripgrep.onMatch((payload: unknown) => {
      const data = payload as { searchId?: string; payload?: { filePath?: string; matches?: Array<{ lineText?: string }> } }
      if (data?.searchId !== searchId) return
      const filePath = data?.payload?.filePath
      const matches = data?.payload?.matches
      if (filePath && matches?.length) {
        const snippet = matches.map(m => m.lineText || '').filter(Boolean).join(' ... ').slice(0, 200)
        results.push({ path: filePath, snippet })
      }
    })

    const unsubDone = window.ripgrep.onDone(() => {
      unsubMatch()
      unsubDone()
      unsubError()
      resolve(results)
    })

    const unsubError = window.ripgrep.onError(() => {
      unsubMatch()
      unsubDone()
      unsubError()
      reject(new Error('Search failed'))
    })

    window.ripgrep.start({
      searchId,
      mode: 'text',
      directories: [rootPath],
      pattern: query,
      options: {
        inclusions: ['*.md'],
        maxResults: 100,
      },
    }).catch(reject)
  })
}
