<template>
  <div
    v-if="visible && completion"
    class="ai-autocomplete"
    :style="overlayStyle"
  >
    <span class="ghost-text">{{ completion }}</span>
    <span class="hint">Tab</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted, watch } from 'vue'
import { useAIStore } from '@/store/aiStore'

const props = defineProps<{
  context: string
  cursorPosition: number
  enabled: boolean
}>()

const emit = defineEmits<{
  (e: 'accept', text: string): void
}>()

const store = useAIStore()
const visible = ref(false)
const completion = ref('')
const overlayStyle = ref<Record<string, string>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

async function requestCompletion (): Promise<void> {
  if (!props.enabled || !store.isReady) return
  if (!props.context.trim()) return

  const currentId = ++requestId

  try {
    const resp = await store.autocomplete({
      context: props.context,
      cursorPosition: props.cursorPosition,
    })

    // Only show if this is still the latest request
    if (currentId === requestId && resp.completion) {
      completion.value = resp.completion
      visible.value = true
    }
  } catch {
    // Silently fail — autocomplete is best-effort
  }
}

function debounceRequest (): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  visible.value = false
  completion.value = ''
  debounceTimer = setTimeout(requestCompletion, 300)
}

function accept (): void {
  if (visible.value && completion.value) {
    emit('accept', completion.value)
    visible.value = false
    completion.value = ''
  }
}

function dismiss (): void {
  visible.value = false
  completion.value = ''
}

// Watch for context changes
watch(() => [props.context, props.cursorPosition], debounceRequest)

// Expose accept/dismiss for parent to call via keyboard shortcuts
defineExpose({ accept, dismiss })

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<style scoped>
.ai-autocomplete {
  position: absolute;
  pointer-events: none;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ghost-text {
  color: var(--text-tertiary, rgba(255, 255, 255, 0.3));
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  white-space: pre-wrap;
  user-select: none;
}

.hint {
  font-size: 10px;
  color: var(--text-tertiary, rgba(255, 255, 255, 0.2));
  background: var(--surface-2, rgba(255, 255, 255, 0.05));
  padding: 1px 4px;
  border-radius: 3px;
  user-select: none;
}
</style>
