<template>
  <div
    v-if="visible"
    class="ai-summary-panel"
  >
    <div class="panel-header">
      <span class="panel-title">Summary</span>
      <button
        class="close-btn"
        @click="$emit('close')"
      >
        &times;
      </button>
    </div>
    <div class="panel-body">
      <div
        v-if="loading"
        class="loading"
      >
        <div class="spinner" />
        <span>Generating summary...</span>
      </div>
      <div v-else-if="summary">
        <p class="summary-text">
          {{ summary }}
        </p>
        <div class="result-actions">
          <button
            class="copy-btn"
            @click="copySummary"
          >
            Copy
          </button>
          <button
            class="copy-btn"
            @click="generate"
          >
            Regenerate
          </button>
        </div>
      </div>
      <p
        v-else-if="error"
        class="error-text"
      >
        {{ error }}
      </p>
      <button
        v-else
        class="generate-btn"
        @click="generate"
      >
        Generate Summary
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAIStore } from '@/store/aiStore'

const props = defineProps<{
  visible: boolean
  content?: string
}>()

defineEmits<{
  (e: 'close'): void
}>()

const store = useAIStore()
const loading = ref(false)
const summary = ref('')
const error = ref('')

async function generate (): Promise<void> {
  if (!store.isReady) {
    error.value = 'AI is not available. Please download and start the model first.'
    return
  }
  if (!props.content) {
    error.value = 'No content to summarize. Open a note first.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const resp = await store.summarize({ text: props.content, maxLength: 100 })
    summary.value = resp.summary
  } catch (err) {
    error.value = String(err)
  } finally {
    loading.value = false
  }
}

async function copySummary (): Promise<void> {
  if (summary.value) {
    await navigator.clipboard.writeText(summary.value)
  }
}

defineExpose({ generate })
</script>

<style scoped>
.ai-summary-panel {
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  background: var(--surface-1, #1a1a1a);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color, #333);
}

.panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #eee);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary, #999);
  cursor: pointer;
  font-size: 18px;
  padding: 0 4px;
  line-height: 1;
}

.close-btn:hover { color: var(--text-primary, #eee); }

.panel-body {
  padding: 12px;
}

.loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary, #999);
  font-size: 13px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--border-color, #333);
  border-top-color: var(--accent-color, #4a9eff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.summary-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary, #eee);
  margin: 0;
}

.error-text {
  font-size: 13px;
  color: var(--error-color, #f44336);
  margin: 0;
}

.generate-btn {
  background: var(--accent-color, #4a9eff);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}

.generate-btn:hover { opacity: 0.85; }

.result-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.copy-btn {
  background: var(--surface-2, rgba(255, 255, 255, 0.06));
  color: var(--text-secondary, #999);
  border: 1px solid var(--surface-2, rgba(255, 255, 255, 0.06));
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  cursor: pointer;
}

.copy-btn:hover {
  background: var(--surface-3, rgba(255, 255, 255, 0.1));
  color: var(--text-primary, #eee);
}
</style>
