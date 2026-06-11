<template>
  <div class="file-tree">
    <div class="tree-header">
      <span class="tree-title">{{ t('fileTree.title') }}</span>
      <div class="tree-actions">
        <button
          class="icon-btn"
          :title="t('fileTree.newNote')"
          @click="handleNewNote"
        >
          +
        </button>
        <button
          class="icon-btn"
          :title="t('fileTree.newFolder')"
          @click="handleNewFolder"
        >
          📁
        </button>
        <button
          class="icon-btn"
          :title="t('fileTree.refresh')"
          @click="store.refreshTree()"
        >
          ↻
        </button>
      </div>
    </div>

    <div
      v-if="!store.hasRoot"
      class="empty-state"
    >
      <p>{{ t('fileTree.noKB') }}</p>
      <button
        class="open-btn"
        @click="openFolder"
      >
        {{ t('fileTree.openFolder') }}
      </button>
    </div>

    <div
      v-else
      class="tree-content"
    >
      <input
        v-model="searchText"
        class="search-input"
        :placeholder="t('fileTree.searchPlaceholder')"
        @input="handleSearch"
      >
      <div class="tree-nodes">
        <FileTreeNode
          v-for="node in store.tree"
          :key="node.path"
          :node="node"
          :depth="0"
          @select="store.selectNode"
          @toggle="store.toggleExpand"
          @context-menu="showContextMenu"
        />
      </div>

      <div
        v-if="searchText && store.searchResults.length > 0"
        class="search-results"
      >
        <div class="search-results-header">
          <span>{{ t('fileTree.resultsCount', { count: store.searchResults.length }) }}</span>
          <button
            class="clear-btn"
            @click="searchText = ''; store.search('')"
          >
            &times;
          </button>
        </div>
        <div
          v-for="result in store.searchResults"
          :key="result.path"
          class="search-result-item"
          @click="store.selectNode(result.path)"
        >
          <span class="result-path">{{ result.path.split('/').pop() }}</span>
          <span class="result-snippet">{{ result.snippet }}</span>
        </div>
      </div>
      <div
        v-else-if="searchText && store.searchResults.length === 0"
        class="search-empty"
      >
        {{ t('fileTree.noResults') }}
      </div>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <div
          class="ctx-item"
          @click="handleNewNote"
        >
          {{ t('fileTree.newNote') }}
        </div>
        <div
          class="ctx-item"
          @click="handleNewFolder"
        >
          {{ t('fileTree.newFolder') }}
        </div>
        <div class="ctx-sep" />
        <div
          class="ctx-item"
          @click="handleRename"
        >
          {{ t('fileTree.rename') }}
        </div>
        <div
          class="ctx-item ctx-danger"
          @click="handleDelete"
        >
          {{ t('fileTree.delete') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKBStore } from '@/store/kbStore'
import FileTreeNode from './FileTreeNode.vue'
import type { KBFileNode } from '@/store/kbStore'

const { t } = useI18n()
const store = useKBStore()
const searchText = ref('')

const ctxMenu = ref({ visible: false, x: 0, y: 0, node: null as KBFileNode | null })

function showContextMenu (node: KBFileNode, event: MouseEvent): void {
  store.selectNode(node.path)
  ctxMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    node,
  }
}

function hideContextMenu (): void {
  ctxMenu.value.visible = false
}

// Close on click outside
function handleGlobalClick (e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (!target.closest('.ctx-menu')) {
    hideContextMenu()
  }
}

onMounted(() => { document.addEventListener('click', handleGlobalClick) })
onUnmounted(() => { document.removeEventListener('click', handleGlobalClick) })

function openFolder (): void {
  window.electron.ipcRenderer.send('mt::cmd-open-folder')
}

async function handleNewNote (): Promise<void> {
  hideContextMenu()
  if (!store.rootPath) { openFolder(); return }
  const parentPath = ctxMenu.value.node?.isDirectory
    ? ctxMenu.value.node.path
    : (store.selectedNode?.isDirectory ? store.selectedPath : store.rootPath) || store.rootPath
  await store.createNote(parentPath!, t('fileTree.unnamedNote'))
}

async function handleNewFolder (): Promise<void> {
  hideContextMenu()
  if (!store.rootPath) { openFolder(); return }
  const parentPath = ctxMenu.value.node?.isDirectory
    ? ctxMenu.value.node.path
    : (store.selectedNode?.isDirectory ? store.selectedPath : store.rootPath) || store.rootPath
  await store.createFolder(parentPath!, t('fileTree.defaultFolderName'))
}

async function handleDelete (): Promise<void> {
  hideContextMenu()
  const node = ctxMenu.value.node
  if (!node) return

  const confirmed = window.confirm(
    node.isDirectory
      ? t('fileTree.confirmDeleteFolder', { name: node.name })
      : t('fileTree.confirmDelete', { name: node.name })
  )
  if (!confirmed) return

  try {
    await store.deleteNode(node.path)
  } catch (err) {
    console.error(t('fileTree.deleteFailed'), err)
  }
}

async function handleRename (): Promise<void> {
  hideContextMenu()
  const node = ctxMenu.value.node
  if (!node) return

  const newName = window.prompt(t('fileTree.inputNewName'), node.name)
  if (!newName || newName === node.name) return

  try {
    await store.renameNode(node.path, newName)
  } catch (err) {
    console.error(t('fileTree.renameFailed'), err)
  }
}

function handleSearch (): void {
  store.search(searchText.value)
}
</script>

<style scoped>
.file-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
  color: #1a1a1a;
  font-size: 13px;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
}

.tree-title {
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
}

.tree-actions {
  display: flex;
  gap: 2px;
}

.icon-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 3px;
  border-radius: 4px;
  line-height: 1;
}

.icon-btn:hover {
  background: #ebebeb;
  color: #555;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  color: #aaa;
  font-size: 13px;
}

.open-btn {
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 13px;
  cursor: pointer;
}

.open-btn:hover { background: #1557b0; }

.tree-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.search-input {
  margin: 8px 12px;
  padding: 5px 9px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  color: #1a1a1a;
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.08);
}

.search-input::placeholder {
  color: #bbb;
}

.tree-nodes {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px 0;
  min-height: 0;
}

.search-results {
  border-top: 1px solid #eee;
  overflow-y: auto;
  flex: 1;
}

.search-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 11px;
  color: #888;
}

.clear-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
}

.search-result-item {
  padding: 5px 12px;
  cursor: pointer;
}

.search-result-item:hover {
  background: #f5f5f5;
}

.result-path {
  display: block;
  font-size: 13px;
  color: #1a1a1a;
  margin-bottom: 1px;
}

.result-snippet {
  display: block;
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 13px;
  color: #aaa;
}

/* Context Menu */
.ctx-menu {
  position: fixed;
  z-index: 10000;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.ctx-item {
  padding: 6px 14px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
}

.ctx-item:hover {
  background: #f0f0f0;
}

.ctx-danger {
  color: #d93025;
}

.ctx-danger:hover {
  background: #fce8e6;
}

.ctx-sep {
  height: 1px;
  background: #eee;
  margin: 4px 0;
}
</style>
