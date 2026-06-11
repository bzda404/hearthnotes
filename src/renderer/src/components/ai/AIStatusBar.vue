<template>
  <div
    class="ai-status-bar"
    :class="statusClass"
  >
    <div class="status-dot" />
    <span
      class="status-label"
      :title="store.statusDetail"
    >{{ store.statusLabel }}</span>
    <button
      v-if="!store.isReady && !store.isStarting"
      class="action-btn"
      @click="handleAction"
    >
      {{ actionLabel }}
    </button>
    <span
      v-if="store.tokPerSec"
      class="perf-info"
    >
      {{ store.tokPerSec }} tok/s
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAIStore } from '@/store/aiStore'

const store = useAIStore()

const statusClass = computed(() => ({
  'status-stopped': store.status === 'stopped',
  'status-starting': store.status === 'starting',
  'status-ready': store.status === 'ready',
  'status-error': store.status === 'error',
}))

const actionLabel = computed(() => {
  if (store.status === 'error') return '重试'
  if (store.needsLightweightModel || !store.hasModel) return '安装轻量模型'
  return '刷新'
})

async function handleAction (): Promise<void> {
  if (store.needsLightweightModel || !store.hasModel) {
    await store.downloadModel()
  } else {
    await store.fetchStatus()
  }
}

onMounted(() => {
  store.fetchStatus()
})
</script>

<style scoped>
.ai-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  border-radius: 6px;
  background: var(--sidebar-bg, #1e1e1e);
  color: var(--text-secondary, #999);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-stopped .status-dot { background: var(--text-tertiary, rgba(255, 255, 255, 0.4)); }
.status-starting .status-dot { background: var(--warning-color, #f0a020); animation: pulse 1s infinite; }
.status-ready .status-dot { background: var(--success-color, #4caf50); }
.status-error .status-dot { background: var(--error-color, #f44336); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.action-btn {
  background: var(--accent-color, #4a9eff);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn:hover {
  opacity: 0.85;
}

.perf-info {
  color: var(--text-tertiary, #666);
  font-size: 11px;
}
</style>
