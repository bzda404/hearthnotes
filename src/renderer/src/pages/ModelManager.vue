<template>
  <div class="model-manager">
    <!-- 顶部导航 -->
    <div class="mm-topbar">
      <button
        class="mm-back"
        @click="goBack"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        ><polyline points="15 18 9 12 15 6" /></svg>
        {{ t('modelManager.backToNotes') }}
      </button>
      <h1 class="mm-title">
        {{ t('modelManager.title') }}
      </h1>
      <span
        class="mm-status"
        :class="{ online: hubConnected }"
        :title="coreDetail"
      >
        {{ coreLabel }}
      </span>
    </div>

    <!-- 未连接 -->
    <div
      v-if="!hubConnected"
      class="mm-disconnect"
    >
      <div class="dc-icon">
        ⚡
      </div>
      <h2>{{ t('modelManager.notRunning') }}</h2>
      <p>{{ t('modelManager.startCore') }}</p>
      <button
        class="btn-primary"
        @click="checkHub"
      >
        {{ t('modelManager.reconnect') }}
      </button>
    </div>

    <!-- 已连接 -->
    <div
      v-else
      class="mm-body"
    >
      <div class="mm-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="mm-tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab: 模型管理 -->
      <div
        v-if="activeTab === 'models'"
        class="mm-tab-content"
      >
        <div
          v-if="hubConnected && !loadedModel"
          class="mm-core-hint"
          :class="{ warning: coreNeedsModel }"
        >
          <div>
            <span class="hint-title">{{ coreNeedsModel ? t('modelManager.needModel') : t('modelManager.coreConnected') }}</span>
            <span class="hint-detail">{{ coreDetail }}</span>
          </div>
        </div>

        <!-- 当前运行 -->
        <div
          v-if="loadedModel"
          class="mm-running-card"
        >
          <div class="rc-left">
            <span class="rc-badge running">{{ t('modelManager.running') }}</span>
            <span class="rc-name">{{ loadedModel.name }}</span>
            <span class="rc-meta">{{ loadedModel.quantization }} · {{ formatSize(loadedModel.sizeBytes) }}</span>
          </div>
          <button
            class="btn-sm btn-outline"
            @click="unloadCurrent"
          >
            {{ t('modelManager.unload') }}
          </button>
        </div>

        <!-- 已安装列表 -->
        <div class="mm-section">
          <span class="section-title">{{ t('modelManager.installedModels') }}</span>
          <div
            v-if="installedModels.length === 0"
            class="mm-empty"
          >
            {{ t('modelManager.noModels') }}
          </div>
          <div
            v-else
            class="mm-list"
          >
            <div
              v-for="model in installedModels"
              :key="model.id"
              class="mm-row"
              :class="{ blocked: !model.loadable }"
            >
              <div class="row-info">
                <div class="row-title">
                  <span class="row-name">{{ model.name }}</span>
                  <span
                    v-if="!model.loadable"
                    class="badge-blocked"
                  >{{ t('modelManager.notLoadable') }}</span>
                </div>
                <span class="row-meta">{{ model.quantization }} · {{ model.parameterSize || t('modelManager.unknownParams') }} · {{ formatSize(model.sizeBytes) }}</span>
                <span
                  v-if="model.loadBlockReason"
                  class="row-warning"
                >{{ model.loadBlockReason }}</span>
              </div>
              <div class="row-actions">
                <button
                  v-if="loadedModel?.id !== model.id"
                  class="btn-sm btn-primary"
                  :disabled="!model.loadable"
                  :title="model.loadBlockReason || t('modelManager.loadModel')"
                  @click="loadModel(model.id)"
                >
                  {{ t('modelManager.load') }}
                </button>
                <span
                  v-else
                  class="badge-running"
                >{{ t('modelManager.running') }}</span>
                <button
                  class="btn-sm btn-danger"
                  @click="deleteModel(model.id)"
                >
                  {{ t('modelManager.delete') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 下载新模型 -->
        <div class="mm-section">
          <div class="section-head">
            <span class="section-title">{{ t('modelManager.downloadNew') }}</span>
            <button
              class="btn-sm btn-outline"
              @click="importLocalModel"
            >
              {{ t('modelManager.importGGUF') }}
            </button>
          </div>

          <!-- 搜索框 -->
          <div class="mm-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><circle
              cx="11"
              cy="11"
              r="8"
            /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            /></svg>
            <input
              v-model="searchQuery"
              class="search-input"
              :placeholder="t('modelManager.searchPlaceholder')"
              @keydown.enter="searchModels"
            >
            <button
              v-if="searchQuery"
              class="search-clear"
              @click="searchQuery = ''; searchResults = []"
            >
              &times;
            </button>
            <button
              class="btn-sm btn-primary"
              :disabled="searching || !searchQuery"
              @click="searchModels"
            >
              {{ t('modelManager.search') }}
            </button>
          </div>

          <!-- 搜索结果 -->
          <div
            v-if="searching"
            class="mm-searching"
          >
            <div class="spinner" /><span>{{ t('modelManager.searching') }}</span>
          </div>
          <div
            v-else-if="searchResults.length > 0"
            class="mm-download-grid"
          >
            <div
              v-for="m in searchResults"
              :key="m.name"
              class="mm-download-card"
            >
              <div class="dc-top">
                <span class="dc-name">{{ m.name }}</span>
                <span class="dc-size">{{ m.source }}</span>
              </div>
              <p class="dc-desc">
                {{ m.desc }}
              </p>
              <button
                class="btn-sm btn-primary"
                :disabled="downloading === m.name || !hubConnected"
                @click="download(m)"
              >
                {{ downloading === m.name ? t('modelManager.downloading', { percent: dlPercent }) : t('modelManager.download') }}
              </button>
              <div
                v-if="downloading === m.name"
                class="dl-bar"
              >
                <div
                  class="dl-fill"
                  :style="{ width: dlPercent + '%' }"
                />
              </div>
            </div>
          </div>

          <!-- 推荐模型（搜索为空时显示） -->
          <div
            v-else
            class="mm-download-grid"
          >
            <div
              v-for="m in availableModels"
              :key="m.name"
              class="mm-download-card"
            >
              <div class="dc-top">
                <span class="dc-name">{{ m.name }}</span>
                <span class="dc-size">{{ m.size }}</span>
              </div>
              <p class="dc-desc">
                {{ m.desc }}
              </p>
              <button
                class="btn-sm btn-primary"
                :disabled="downloading === m.name || !hubConnected"
                @click="download(m)"
              >
                {{ downloading === m.name ? t('modelManager.downloading', { percent: dlPercent }) : t('modelManager.download') }}
              </button>
              <div
                v-if="downloading === m.name"
                class="dl-bar"
              >
                <div
                  class="dl-fill"
                  :style="{ width: dlPercent + '%' }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: 应用互联 -->
      <div
        v-if="activeTab === 'linked'"
        class="mm-tab-content"
      >
        <!-- 已连接应用 -->
        <div class="mm-section">
          <span class="section-title">{{ t('modelManager.linkedApps') }}</span>
          <div
            v-if="linkedApps.length === 0"
            class="mm-empty"
          >
            {{ t('modelManager.noLinkedApps') }}
          </div>
          <div
            v-else
            class="mm-list"
          >
            <div
              v-for="app in linkedApps"
              :key="app.name"
              class="mm-app-row"
            >
              <div
                class="app-icon"
                :style="{ background: app.color }"
              >
                {{ app.icon }}
              </div>
              <div class="app-info">
                <span class="app-name">{{ app.name }}</span>
                <span class="app-detail">{{ t('modelManager.model') }}{{ app.model }} · {{ t('modelManager.shared') }}{{ app.sharedData }}</span>
              </div>
              <span class="app-badge connected">{{ t('modelManager.connected') }}</span>
            </div>
          </div>
        </div>

        <!-- 快速连接 -->
        <div class="mm-section">
          <span class="section-title">{{ t('modelManager.connectNew') }}</span>
          <div class="mm-connect-card">
            <p class="connect-hint">
              {{ t('modelManager.pairHint') }}
            </p>
            <div class="pair-code">
              <span class="code-text">{{ pairCode }}</span>
              <button
                class="btn-sm btn-outline"
                @click="refreshCode"
              >
                {{ t('modelManager.refresh') }}
              </button>
              <button
                class="btn-sm btn-primary"
                @click="copyCode"
              >
                {{ t('modelManager.copy') }}
              </button>
            </div>
            <p class="connect-note">
              {{ t('modelManager.pairExpiry') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import type { AISidecarStatus, InstalledModelInfo } from '@shared/types/aiTypes'
import { useAIStore } from '@/store/aiStore'

const { t } = useI18n()
const router = useRouter()
const aiStore = useAIStore()

const hubConnected = ref(false)
const aiStatus = ref<AISidecarStatus | null>(null)
const activeTab = ref<'models' | 'linked'>('models')
const installedModels = ref<InstalledModelInfo[]>([])
const loadedModel = ref<InstalledModelInfo | null>(null)
const downloading = ref<string | null>(null)
const dlPercent = ref(0)
const pairCode = ref(generateCode())
const searchQuery = ref('')
const searchResults = ref<Array<{ name: string; desc: string; size: string; source: string }>>([])
const searching = ref(false)

const tabs = [
  { id: 'models' as const, label: t('modelManager.tabModels') },
  { id: 'linked' as const, label: t('modelManager.tabLinked') },
]

const coreNeedsModel = computed(() => {
  const core = aiStatus.value?.core
  return core?.running === true && !loadedModel.value && core.defaultModel?.loaded === false
})

const coreLabel = computed(() => {
  if (!hubConnected.value) return t('modelManager.statusDisconnected')
  if (loadedModel.value) return t('modelManager.statusReady')
  if (coreNeedsModel.value) return t('modelManager.statusNeedModel')
  return t('modelManager.statusOnline')
})

const coreDetail = computed(() => {
  if (!hubConnected.value) return t('modelManager.coreNotRunning')
  if (loadedModel.value) return `${loadedModel.value.name} · ${loadedModel.value.parameterSize || t('modelManager.unknownParams')}`
  return aiStatus.value?.core.defaultModel?.reason || t('modelManager.installModelHint')
})

// 已连接应用（实际应从 AinCore API 获取）
const linkedApps = ref([
  {
    name: 'AinCore Note',
    icon: 'M',
    color: '#1a73e8',
    model: 'Qwen3.5-0.8B',
    sharedData: t('modelManager.sharedNotes'),
  },
])

// 可下载模型
const availableModels = [
  { name: 'Qwen2.5-0.5B-Coder', size: '~400MB', desc: t('modelManager.descQwenCoder'), url: 'hf://bartowski/Qwen2.5-Coder-0.5B-Instruct-GGUF' },
  { name: 'Qwen3.5-0.8B', size: '~500MB', desc: t('modelManager.descQwenHelper'), url: 'hf://lmstudio-community/Qwen3.5-0.8B-GGUF' },
  { name: 'Qwen3-0.6B', size: '~430MB', desc: t('modelManager.descQwenTiny'), url: 'hf://unsloth/Qwen3-0.6B-GGUF' },
  { name: 'Llama-3.2-1B', size: '~684MB', desc: t('modelManager.descLlama'), url: 'hf://bartowski/Llama-3.2-1B-Instruct-GGUF' },
]

function goBack (): void { router.push('/workspace') }

function generateCode (): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code.slice(0, 3) + '-' + code.slice(3)
}

function refreshCode (): void { pairCode.value = generateCode() }
function copyCode (): void { navigator.clipboard.writeText(pairCode.value) }

async function checkHub (): Promise<void> {
  try {
    const status = await window.electron.ipcRenderer.invoke('mt::ai::status')
    aiStatus.value = status
    hubConnected.value = status.core.running
    const models = await window.electron.ipcRenderer.invoke('mt::ai::list-models')
    installedModels.value = models || []
    loadedModel.value = models?.find(m => m.status === 'loaded') || null
  } catch {
    hubConnected.value = false
    aiStatus.value = null
  }
}

async function loadModel (id: string): Promise<void> {
  const model = installedModels.value.find(m => m.id === id)
  if (model && !model.loadable) {
    alert(model.loadBlockReason || t('modelManager.loadPolicyBlocked'))
    return
  }
  try {
    await window.electron.ipcRenderer.invoke('mt::ai::load-model', id)
    await checkHub()
  } catch (err) { alert(t('modelManager.loadFailed', { error: String(err) })) }
}

async function unloadCurrent (): Promise<void> {
  try {
    await window.electron.ipcRenderer.invoke('mt::ai::unload-model')
    loadedModel.value = null
    await checkHub()
  } catch (err) { alert(t('modelManager.unloadFailed', { error: String(err) })) }
}

async function deleteModel (id: string): Promise<void> {
  if (!confirm(t('modelManager.confirmDelete'))) return
  try {
    await window.electron.ipcRenderer.invoke('mt::ai::delete-model', id)
    await checkHub()
  } catch (err) { alert(t('modelManager.deleteFailed', { error: String(err) })) }
}

async function download (m: { name: string; url?: string }): Promise<void> {
  downloading.value = m.name
  dlPercent.value = 0
  try {
    const url = m.url || `hf://lmstudio-community/${m.name}-GGUF`
    await window.electron.ipcRenderer.invoke('mt::ai::download-model', {
      name: m.name + '-Q4_K_M.gguf',
      url,
      quantization: 'Q4_K_M',
      size: '',
    })
  } catch (err) { alert(t('modelManager.downloadFailed', { error: String(err) })) } finally {
    downloading.value = null
    dlPercent.value = 0
    await checkHub()
  }
}

async function importLocalModel (): Promise<void> {
  try {
    await aiStore.importLocalModel()
    await checkHub()
  } catch (err) {
    alert(t('modelManager.importFailed', { error: String(err) }))
  }
}

async function searchModels (): Promise<void> {
  if (!searchQuery.value.trim()) { searchResults.value = []; return }
  searching.value = true
  searchResults.value = []
  try {
    const results = await window.electron.ipcRenderer.invoke('mt::ai::search-models', searchQuery.value) as Array<{ name: string; desc: string; source: string }>
    searchResults.value = results.map(r => ({
      name: r.name,
      desc: r.desc,
      size: t('modelManager.hfMirror'),
      source: r.source,
    }))
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function formatSize (bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(0)} MB`
}

onMounted(() => { checkHub() })
</script>

<style scoped>
.model-manager {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #fff;
  color: #1a1a1a;
  overflow: hidden;
}

/* Topbar */
.mm-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.mm-back {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; color: #555;
  cursor: pointer; font-size: 13px; padding: 4px 8px; border-radius: 6px;
}
.mm-back:hover { background: #f5f5f5; }

.mm-title { font-size: 18px; font-weight: 600; margin: 0; flex: 1; }

.mm-status {
  font-size: 12px; padding: 3px 10px; border-radius: 10px;
  background: #f1f3f4; color: #888;
}
.mm-status.online { background: #e6f4ea; color: #137333; }

/* Disconnect */
.mm-disconnect {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; color: #888;
}
.dc-icon { font-size: 48px; }
.mm-disconnect h2 { font-size: 18px; margin: 0; color: #333; }
.mm-disconnect p { margin: 0; font-size: 14px; }

.btn-primary {
  background: #1a73e8; color: white; border: none;
  border-radius: 6px; padding: 8px 18px; font-size: 13px; cursor: pointer;
}
.btn-primary:hover { background: #1557b0; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Body */
.mm-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Tabs */
.mm-tabs {
  display: flex; padding: 0 24px;
  border-bottom: 1px solid #eee; flex-shrink: 0;
}
.mm-tab {
  background: none; border: none; padding: 10px 20px;
  font-size: 13px; font-weight: 500; color: #888;
  cursor: pointer; border-bottom: 2px solid transparent;
}
.mm-tab:hover { color: #555; }
.mm-tab.active { color: #1a73e8; border-bottom-color: #1a73e8; }

/* Tab content */
.mm-tab-content { flex: 1; overflow-y: auto; padding: 20px 24px; }

.mm-core-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  margin-bottom: 18px;
  border: 1px solid #d7e8d4;
  border-radius: 8px;
  background: #f4fbf3;
}
.mm-core-hint.warning {
  border-color: #f5d7a1;
  background: #fff8e8;
}
.hint-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #2f5931;
  margin-bottom: 3px;
}
.mm-core-hint.warning .hint-title { color: #9a5b00; }
.hint-detail {
  display: block;
  font-size: 12px;
  color: #6f6f6f;
}

/* Running card */
.mm-running-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: #e6f4ea;
  border: 1px solid #c8e6c9; border-radius: 10px; margin-bottom: 24px;
}
.rc-left { display: flex; align-items: center; gap: 10px; }
.rc-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
}
.rc-badge.running { background: #e6f4ea; color: #137333; border: 1px solid #c8e6c9; }
.rc-name { font-size: 14px; font-weight: 600; }
.rc-meta { font-size: 12px; color: #888; }

/* Section */
.mm-section { margin-bottom: 28px; }
.section-title {
  display: block; font-size: 12px; font-weight: 600; color: #888;
  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.section-head .section-title { margin-bottom: 0; }
.mm-empty { text-align: center; padding: 24px; color: #aaa; font-size: 13px; }

/* List */
.mm-list { display: flex; flex-direction: column; gap: 6px; }

.mm-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px; background: #f8f9fa; border: 1px solid #eee; border-radius: 8px;
}
.row-info { display: flex; flex-direction: column; gap: 2px; }
.row-name { font-size: 14px; font-weight: 500; }
.row-meta { font-size: 12px; color: #888; }
.row-actions { display: flex; gap: 6px; }
.badge-running {
  font-size: 11px; color: #137333; background: #e6f4ea;
  padding: 3px 8px; border-radius: 4px;
}

/* Buttons */
.btn-sm {
  padding: 5px 12px; border-radius: 5px; font-size: 12px;
  cursor: pointer; border: none;
}
.btn-primary { background: #1a73e8; color: white; }
.btn-primary:hover { background: #1557b0; }
.btn-outline { background: none; border: 1px solid #ddd; color: #555; }
.btn-outline:hover { background: #f5f5f5; }
.btn-danger { background: none; border: 1px solid #f44336; color: #f44336; }
.btn-danger:hover { background: #fce8e6; }

/* Download grid */
.mm-download-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;
}

/* Search */
.mm-search {
  display: flex; align-items: center; gap: 8px;
  background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
  padding: 8px 12px; margin-bottom: 14px;
}
.mm-search:focus-within { border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.08); }
.search-input {
  flex: 1; background: none; border: none; font-size: 13px; color: #1a1a1a; outline: none;
}
.search-input::placeholder { color: #bbb; }
.search-clear {
  background: none; border: none; color: #888; cursor: pointer; font-size: 18px; padding: 0 4px;
}

.mm-searching {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 32px; color: #888; font-size: 13px;
}
.spinner {
  width: 18px; height: 18px;
  border: 2px solid #e0e0e0; border-top-color: #1a73e8;
  border-radius: 50%; animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.mm-download-card {
  background: #f8f9fa; border: 1px solid #eee; border-radius: 10px;
  padding: 16px; display: flex; flex-direction: column; gap: 8px;
}
.dc-top { display: flex; align-items: center; justify-content: space-between; }
.dc-name { font-size: 14px; font-weight: 600; }
.dc-size { font-size: 11px; color: #888; }
.dc-desc { font-size: 12px; color: #666; line-height: 1.4; margin: 0; }
.dl-bar { height: 3px; background: #e8eaed; border-radius: 2px; overflow: hidden; margin-top: 4px; }
.dl-fill { height: 100%; background: #1a73e8; border-radius: 2px; transition: width 0.3s; }

/* App rows */
.mm-app-row {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: #f8f9fa; border: 1px solid #eee; border-radius: 10px;
}
.app-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; font-weight: 700; color: white; flex-shrink: 0;
}
.app-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.app-name { font-size: 14px; font-weight: 500; }
.app-detail { font-size: 12px; color: #888; }
.app-badge {
  font-size: 11px; padding: 3px 10px; border-radius: 10px;
}
.app-badge.connected { background: #e6f4ea; color: #137333; }

/* Connect card */
.mm-connect-card {
  background: #f8f9fa; border: 1px solid #eee; border-radius: 10px;
  padding: 20px; display: flex; flex-direction: column; gap: 14px;
}
.connect-hint { font-size: 13px; color: #555; margin: 0; line-height: 1.5; }

.pair-code {
  display: flex; align-items: center; gap: 10px;
  background: #fff; border: 2px dashed #1a73e8; border-radius: 8px;
  padding: 12px 16px;
}
.code-text {
  flex: 1; font-size: 28px; font-weight: 700; letter-spacing: 4px;
  color: #1a73e8; font-family: 'SF Mono', Monaco, Consolas, monospace;
}
.connect-note { font-size: 11px; color: #aaa; margin: 0; }
</style>
