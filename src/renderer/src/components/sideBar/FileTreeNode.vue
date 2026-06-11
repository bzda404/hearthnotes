<template>
  <div
    class="tree-node"
    :class="{ selected: isSelected, 'is-directory': node.isDirectory }"
    :style="{ paddingLeft: depth * 16 + 'px' }"
    @click="handleClick"
    @contextmenu.prevent="$emit('contextMenu', node, $event)"
  >
    <span
      v-if="node.isDirectory"
      class="expand-icon"
      :class="{ expanded: node.expanded }"
    >▶</span>
    <span
      v-else
      class="file-icon"
    >{{ fileIcon(node.name) }}</span>
    <span
      class="node-name"
      :title="node.path"
    >{{ node.name }}</span>
    <span
      v-if="!node.isDirectory && node.size"
      class="node-size"
    >
      {{ formatSize(node.size) }}
    </span>
  </div>

  <template v-if="node.isDirectory && node.expanded">
    <FileTreeNode
      v-for="child in node.children"
      :key="child.path"
      :node="child"
      :depth="depth + 1"
      @select="$emit('select', $event)"
      @toggle="$emit('toggle', $event)"
      @context-menu="(n, e) => $emit('contextMenu', n, e)"
    />
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useKBStore } from '@/store/kbStore'
import type { KBFileNode } from '@/store/kbStore'

const props = defineProps<{
  node: KBFileNode
  depth: number
}>()

const emit = defineEmits<{
  (e: 'select', path: string): void
  (e: 'toggle', node: KBFileNode): void
  (e: 'contextMenu', node: KBFileNode, event: MouseEvent): void
}>()

const store = useKBStore()
const isSelected = computed(() => store.selectedPath === props.node.path)

function handleClick (): void {
  if (props.node.isDirectory) {
    emit('toggle', props.node)
  }
  emit('select', props.node.path)
}

function formatSize (bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileIcon (name: string): string {
  if (name.endsWith('.md')) return '📝'
  if (name.endsWith('.txt')) return '📄'
  if (name.endsWith('.pdf')) return '📕'
  if (name.endsWith('.xlsx') || name.endsWith('.csv')) return '📊'
  if (name.endsWith('.pptx')) return '📑'
  return '📄'
}
</script>

<style scoped>
.tree-node {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 12px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  overflow: hidden;
  transition: background 0.08s;
}

.tree-node:hover {
  background: #f0f0f0;
}

.tree-node.selected {
  background: #e8f0fe;
  border-left: 2px solid #1a73e8;
}

.expand-icon {
  font-size: 9px;
  transition: transform 0.12s;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  color: #888;
}

.expand-icon:hover {
  background: #e0e0e0;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.file-icon {
  font-size: 13px;
  flex-shrink: 0;
  width: 16px;
  text-align: center;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #333;
}

.node-size {
  font-size: 11px;
  color: #bbb;
  flex-shrink: 0;
}
</style>
