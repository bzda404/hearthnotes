<template>
  <div
    class="drop-zone"
    :class="{ active: isDragging }"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div
      v-if="isDragging"
      class="drop-overlay"
    >
      <div class="drop-content">
        <div class="drop-icon">
          📥
        </div>
        <p class="drop-text">
          拖放文件转换为 Markdown
        </p>
        <p class="drop-hint">
          支持 PDF、Word、Excel、HTML、CSV、TXT
        </p>
      </div>
    </div>

    <div
      v-if="converting"
      class="convert-progress"
    >
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progress + '%' }"
        />
      </div>
      <span class="progress-text">正在转换 {{ currentFile }}...</span>
    </div>

    <slot />

    <div
      v-if="errorMessage"
      class="drop-error"
    >
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useKBStore } from '@/store/kbStore'

const emit = defineEmits<{
  (e: 'converted', path: string): void
}>()

const store = useKBStore()
const isDragging = ref(false)
const converting = ref(false)
const progress = ref(0)
const currentFile = ref('')
const errorMessage = ref('')
let dragCounter = 0

const CONVERTIBLE_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.html', '.htm', '.csv', '.txt', '.rtf', '.odt', '.epub',
]

function isConvertible (filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  return CONVERTIBLE_EXTENSIONS.includes(ext)
}

function showError (msg: string): void {
  errorMessage.value = msg
  setTimeout(() => { errorMessage.value = '' }, 3000)
}

function onDragOver (_e: DragEvent): void {
  dragCounter++
  isDragging.value = true
}

function onDragLeave (): void {
  dragCounter--
  if (dragCounter <= 0) {
    isDragging.value = false
    dragCounter = 0
  }
}

async function onDrop (e: DragEvent): Promise<void> {
  isDragging.value = false
  dragCounter = 0

  const files = e.dataTransfer?.files
  if (!files?.length) return

  for (const file of Array.from(files)) {
    const filePath = window.electron.webUtils.getPathForFile(file)
    if (!filePath) continue

    if (isConvertible(file.name)) {
      await convertFile(filePath)
    } else if (file.name.endsWith('.md')) {
      // Direct markdown file — just copy to knowledge base
      emit('converted', filePath)
    } else {
      showError(`不支持的文件类型：${file.name}`)
    }
  }
}

async function convertFile (filePath: string): Promise<void> {
  converting.value = true
  currentFile.value = filePath.split('/').pop() || filePath
  progress.value = 0

  try {
    // Simulate progress for now — real progress comes via IPC
    const progressInterval = setInterval(() => {
      if (progress.value < 90) progress.value += 10
    }, 200)

    const result = await window.electron.ipcRenderer.invoke(
      'mt::fileConvert::convert',
      filePath,
      store.rootPath || undefined
    )

    clearInterval(progressInterval)
    progress.value = 100

    if (result) {
      emit('converted', result as string)
      await store.refreshTree()
    }
  } catch (err) {
    console.error('[DropZone] Conversion failed:', err)
    showError(`转换失败：${currentFile.value}`)
  } finally {
    converting.value = false
    progress.value = 0
    currentFile.value = ''
  }
}
</script>

<style scoped>
.drop-zone {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(74, 158, 255, 0.1);
  border: 2px dashed var(--accent-color, #4a9eff);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
}

.drop-content {
  text-align: center;
}

.drop-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.drop-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #eee);
  margin: 0 0 8px;
}

.drop-hint {
  font-size: 13px;
  color: var(--text-secondary, #999);
  margin: 0;
}

.convert-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px 16px;
  background: var(--surface-1, #1a1a1a);
  border-top: 1px solid var(--border-color, #333);
  z-index: 50;
}

.progress-bar {
  height: 4px;
  background: var(--surface-2, rgba(255, 255, 255, 0.1));
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color, #4a9eff);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.drop-error {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--error-color, #f44336);
  color: white;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 1000;
  animation: fadeInOut 3s ease-in-out;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
  10% { opacity: 1; transform: translateX(-50%) translateY(0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
