<template>
  <el-dialog
    v-model="visible"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    width="500px"
    class="notes-onboarding"
  >
    <template #header>
      <div class="onb-header">
        <span class="onb-step-badge">{{ step }}/2</span>
        <h3>{{ stepTitle }}</h3>
      </div>
    </template>

    <!-- Step 1: Choose Knowledge Base -->
    <div v-if="step === 1" class="onb-body">
      <p class="onb-desc">{{ t('onboarding.notes.step1.desc') }}</p>
      <el-input
        v-model="kbPath"
        :placeholder="t('onboarding.notes.step1.placeholder')"
        readonly
        @click="chooseFolder"
      >
        <template #append>
          <el-button @click="chooseFolder">{{ t('onboarding.notes.step1.browse') }}</el-button>
        </template>
      </el-input>
      <div v-if="kbPath" class="onb-path-preview">
        <span class="path-icon">📁</span>
        <span>{{ kbPath }}</span>
      </div>
    </div>

    <!-- Step 2: Core Connection Status -->
    <div v-if="step === 2" class="onb-body">
      <p class="onb-desc">{{ t('onboarding.notes.step2.desc') }}</p>
      <div class="onb-status-box" :class="coreStatusClass">
        <span class="status-icon">{{ coreStatusIcon }}</span>
        <span>{{ aiStore.statusLabel }}</span>
      </div>
      <p class="onb-hint">{{ t('onboarding.notes.step2.hint') }}</p>
    </div>

    <template #footer>
      <div class="onb-footer">
        <el-button text size="small" @click="skipOnboarding">{{ t('onboarding.skip') }}</el-button>
        <el-button
          v-if="step === 1"
          type="primary"
          :disabled="!kbPath"
          @click="goToStep2"
        >
          {{ t('onboarding.next') }}
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="finishOnboarding"
        >
          {{ t('onboarding.done') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAIStore } from '../../store/aiStore'

const { t } = useI18n()
const aiStore = useAIStore()

const emit = defineEmits<{
  (e: 'complete', kbPath: string): void
  (e: 'skip'): void
}>()

const visible = ref(false)
const step = ref(1)
const kbPath = ref('')

const stepTitle = computed(() =>
  step.value === 1
    ? t('onboarding.notes.step1.title')
    : t('onboarding.notes.step2.title'),
)

const coreStatusClass = computed(() => {
  if (aiStore.isReady) return 'status-ready'
  if (aiStore.isStarting || aiStore.isReconnecting) return 'status-loading'
  return 'status-offline'
})

const coreStatusIcon = computed(() => {
  if (aiStore.isReady) return '✅'
  if (aiStore.isStarting || aiStore.isReconnecting) return '⏳'
  return '⚠️'
})

onMounted(async () => {
  try {
    const done = localStorage.getItem('notes_onboarding_done')
    if (!done) {
      visible.value = true
      await aiStore.fetchStatus()
    }
  } catch {
    // ignore
  }
})

async function chooseFolder() {
  try {
    const result = await (window as unknown as Record<string, unknown> & {
      ai: { selectFolder?: () => Promise<string> }
    }).ai?.selectFolder?.()
    if (result) {
      kbPath.value = result
    }
  } catch {
    // Fallback: user can type path manually
  }
}

function goToStep2() {
  step.value = 2
  aiStore.fetchStatus()
}

function skipOnboarding() {
  markDone()
  visible.value = false
  emit('skip')
}

function finishOnboarding() {
  markDone()
  visible.value = false
  emit('complete', kbPath.value)
}

function markDone() {
  try {
    localStorage.setItem('notes_onboarding_done', 'true')
  } catch {
    // ignore
  }
}

defineExpose({ visible })
</script>

<style scoped>
.onb-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.onb-step-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--mv-brand, #21b56f);
  color: white;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.onb-header h3 {
  margin: 0;
  font-size: 16px;
}

.onb-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.onb-desc {
  font-size: 14px;
  color: var(--mv-text-secondary, #666);
  line-height: 1.5;
  margin: 0;
}

.onb-path-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--mv-bg-secondary, #f5f5f5);
  font-size: 13px;
}

.path-icon {
  font-size: 16px;
}

.onb-status-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.status-ready {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}

.status-loading {
  background: #fefce8;
  color: #854d0e;
  border: 1px solid #fef08a;
}

.status-offline {
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
}

.status-icon {
  font-size: 20px;
}

.onb-hint {
  font-size: 12px;
  color: var(--mv-text-tertiary, #999);
  margin: 0;
}

.onb-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
}
</style>
