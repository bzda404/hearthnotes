<template>
  <div class="aincore-workspace">
    <!-- 1. Icon Navigation Rail (leftmost) -->
    <nav class="nav-rail">
      <div class="nav-top">
        <button
          class="nav-icon"
          :class="{ active: activePanel === 'files' }"
          :title="t('workspace.nav.files')"
          @click="togglePanel('files')"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
        </button>
        <button
          class="nav-icon"
          :class="{ active: activePanel === 'search' }"
          :title="t('workspace.nav.search')"
          @click="togglePanel('search')"
        >
          <svg
            width="18"
            height="18"
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
        </button>
        <button
          class="nav-icon"
          :class="{ active: activePanel === 'bookmarks' }"
          :title="t('workspace.nav.bookmarks')"
          @click="togglePanel('bookmarks')"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
        </button>
        <button
          class="nav-icon"
          :title="t('workspace.nav.modelManager')"
          @click="openModelManager"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><rect
            x="2"
            y="3"
            width="20"
            height="14"
            rx="2"
            ry="2"
          /><line
            x1="8"
            y1="21"
            x2="16"
            y2="21"
          /><line
            x1="12"
            y1="17"
            x2="12"
            y2="21"
          /></svg>
        </button>
      </div>
      <div class="nav-bottom">
        <button
          class="nav-icon"
          :class="{ active: aiPanelVisible }"
          :title="t('workspace.nav.aiAssistant')"
          @click="aiPanelVisible = !aiPanelVisible"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span
            v-if="aiStore.isReady"
            class="nav-dot"
          />
        </button>
        <button
          class="nav-icon"
          :title="t('workspace.nav.toggleTheme')"
          @click="toggleTheme"
        >
          <svg
            v-if="isDark"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><circle
            cx="12"
            cy="12"
            r="5"
          /><line
            x1="12"
            y1="1"
            x2="12"
            y2="3"
          /><line
            x1="12"
            y1="21"
            x2="12"
            y2="23"
          /><line
            x1="4.22"
            y1="4.22"
            x2="5.64"
            y2="5.64"
          /><line
            x1="18.36"
            y1="18.36"
            x2="19.78"
            y2="19.78"
          /><line
            x1="1"
            y1="12"
            x2="3"
            y2="12"
          /><line
            x1="21"
            y1="12"
            x2="23"
            y2="12"
          /><line
            x1="4.22"
            y1="19.78"
            x2="5.64"
            y2="18.36"
          /><line
            x1="18.36"
            y1="5.64"
            x2="19.78"
            y2="4.22"
          /></svg>
          <svg
            v-else
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        </button>
        <button
          class="nav-icon"
          :title="t('workspace.nav.settings')"
          @click="openSettings"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><circle
            cx="12"
            cy="12"
            r="3"
          /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      </div>
    </nav>

    <!-- 2. Side Panel -->
    <aside
      v-if="sidePanelVisible"
      class="side-panel"
    >
      <div
        v-if="activePanel === 'files'"
        class="panel-content"
      >
        <div class="panel-header">
          <span class="panel-title">{{ t('workspace.panel.fileManager') }}</span>
          <div class="panel-actions">
            <button
              class="panel-btn"
              :title="t('fileTree.newNote')"
              @click="handleNewNote"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line
                x1="12"
                y1="18"
                x2="12"
                y2="12"
              /><line
                x1="9"
                y1="15"
                x2="15"
                y2="15"
              /></svg>
            </button>
            <button
              class="panel-btn"
              :title="t('fileTree.newFolder')"
              @click="handleNewFolder"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              ><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line
                x1="12"
                y1="11"
                x2="12"
                y2="17"
              /><line
                x1="9"
                y1="14"
                x2="15"
                y2="14"
              /></svg>
            </button>
            <button
              class="panel-btn"
              :title="t('fileTree.refresh')"
              @click="kbStore.refreshTree()"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            </button>
          </div>
        </div>
        <FileTree />
      </div>

      <div
        v-else-if="activePanel === 'search'"
        class="panel-content"
      >
        <div class="panel-header">
          <span class="panel-title">{{ t('workspace.panel.searchTitle') }}</span>
        </div>
        <div class="search-panel-body">
          <input
            v-model="globalSearchText"
            class="global-search-input"
            :placeholder="t('workspace.panel.searchPlaceholder')"
            @keydown.enter="handleGlobalSearch"
          >
          <div
            v-if="kbStore.searchResults.length > 0"
            class="search-results-list"
          >
            <div
              v-for="result in kbStore.searchResults"
              :key="result.path"
              class="search-result"
              @click="openSearchResult(result.path)"
            >
              <span class="sr-name">{{ result.path.split('/').pop() }}</span>
              <span class="sr-snippet">{{ result.snippet }}</span>
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="activePanel === 'bookmarks'"
        class="panel-content"
      >
        <div class="panel-header">
          <span class="panel-title">{{ t('workspace.panel.bookmarksTitle') }}</span>
        </div>
        <div class="panel-empty">
          <p>{{ t('workspace.panel.noBookmarks') }}</p>
        </div>
      </div>

      <div class="panel-footer">
        <span class="footer-text">{{ kbStore.rootPath ? kbStore.rootPath.split('/').pop() : t('workspace.panel.noKB') }}</span>
      </div>
    </aside>

    <!-- 3. Editor Area -->
    <main class="editor-area">
      <DropZone @converted="onFileConverted">
        <!-- 欢迎页 -->
        <div
          v-if="!currentPreviewPath"
          class="welcome-area"
        >
          <p class="welcome-hint">
            {{ t('workspace.panel.openKB') }}
          </p>
        </div>

        <!-- 文件预览/编辑 -->
        <div
          v-else
          class="preview-area"
        >
          <div class="preview-header">
            <span class="preview-filename">{{ currentPreviewPath.split('/').pop() }}</span>
            <span class="preview-path">{{ currentPreviewPath }}</span>
            <div class="preview-toolbar">
              <button
                class="preview-mode-btn"
                :class="{ active: editMode === 'preview' }"
                @click="editMode = 'preview'"
              >
                {{ t('workspace.editor.preview') }}
              </button>
              <button
                class="preview-mode-btn"
                :class="{ active: editMode === 'edit' }"
                @click="editMode = 'edit'"
              >
                {{ t('workspace.editor.edit') }}
              </button>
              <button
                v-if="aiStore.isReady && editMode === 'edit'"
                class="preview-ai-btn"
                :disabled="aiContinuing"
                @click="aiContinue"
              >
                {{ aiContinuing ? t('workspace.editor.generating') : t('workspace.editor.aiContinue') }}
              </button>
            </div>
          </div>
          <!-- 预览模式 -->
          <div
            v-if="editMode === 'preview'"
            class="preview-body"
            v-html="renderMarkdown(previewContent || t('workspace.editor.loading'))"
          />
          <!-- 编辑模式 -->
          <div
            v-else
            class="edit-area"
          >
            <textarea
              ref="editTextarea"
              class="edit-textarea"
              :value="previewContent || ''"
              :placeholder="t('workspace.editor.startWriting')"
              @input="onEditInput"
              @keydown="onEditKeydown"
            />
            <!-- AI 自动补全 ghost text -->
            <div
              v-if="ghostText"
              class="ghost-overlay"
              :style="ghostStyle"
            >
              <span class="ghost-text">{{ ghostText }}</span>
              <span class="ghost-hint">{{ t('workspace.editor.ghostHint') }}</span>
            </div>
          </div>
        </div>
      </DropZone>
    </main>

    <!-- 4. AI Chat Panel -->
    <aside
      v-if="aiPanelVisible"
      class="ai-panel"
    >
      <div class="ai-header">
        <div class="ai-header-left">
          <span class="ai-logo">M</span>
          <span class="ai-title">AinCore AI</span>
        </div>
        <div class="ai-header-right">
          <span
            class="ai-pill"
            :class="aiStore.status"
          >
            {{ aiStore.statusLabel }}
          </span>
          <span
            v-if="aiStore.coreRunning"
            class="ai-pill hub-connected"
          >Core</span>
          <button
            v-if="messages.length > 0"
            class="panel-btn"
            :title="t('workspace.ai.newChat')"
            @click="startNewChat"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M12 5v14M5 12h14" /></svg>
          </button>
          <button
            class="panel-btn"
            @click="aiPanelVisible = false"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><line
              x1="18"
              y1="6"
              x2="6"
              y2="18"
            /><line
              x1="6"
              y1="6"
              x2="18"
              y2="18"
            /></svg>
          </button>
        </div>
      </div>

      <div
        v-if="aiStore.isDownloading"
        class="ai-dl-bar"
      >
        <div class="dl-track">
          <div
            class="dl-fill"
            :style="{ width: (aiStore.downloadProgress?.percent || 0) + '%' }"
          />
        </div>
        <span class="dl-text">{{ t('workspace.ai.downloading') }} · {{ aiStore.downloadProgress?.percent || 0 }}% · {{ formatSpeed(aiStore.downloadProgress?.speed) }}</span>
      </div>

      <div class="sentinel-strip">
        <span class="sentinel-pill">MCP {{ mcpStore.isRunning ? t('workspace.ai.mcpOnline') : t('workspace.ai.mcpOffline') }}</span>
        <span class="sentinel-pill">{{ mcpStore.ragLabel }}</span>
        <span
          class="sentinel-pill"
          :class="{ active: mcpStore.hasPendingPopup }"
        >{{ t('workspace.ai.sentinel') }} {{ mcpStore.sentinelLabel }}</span>
      </div>

      <div
        v-if="mcpStore.filteredAudit.length"
        class="audit-list"
      >
        <div class="audit-head">
          <span class="audit-title">{{ t('workspace.ai.auditTitle') }}</span>
          <div class="audit-filters">
            <button
              v-for="filter in auditFilters"
              :key="filter.value"
              class="audit-filter"
              :class="{ active: mcpStore.auditDecisionFilter === filter.value }"
              @click="mcpStore.auditDecisionFilter = filter.value"
            >
              {{ filter.label }}
            </button>
          </div>
          <button
            class="audit-clear"
            @click="mcpStore.clearAuditLog()"
          >
            {{ t('workspace.ai.clear') }}
          </button>
        </div>
        <div
          v-for="entry in mcpStore.recentAudit"
          :key="entry.requestId"
          class="audit-row"
        >
          <span class="audit-tool">{{ entry.tool }}</span>
          <span class="audit-client">{{ entry.clientName }}</span>
          <span class="audit-decision">{{ formatAuditDecision(entry.decision) }}</span>
          <span
            v-if="entry.piiCount"
            class="audit-pii"
          >PII {{ entry.piiCount }}</span>
        </div>
      </div>

      <div
        ref="chatContainer"
        class="ai-chat"
      >
        <div
          v-if="!hubConnected"
          class="hub-disconnect"
        >
          <p class="hub-disconnect-text">
            {{ t('workspace.ai.notConnected') }}
          </p>
          <button
            class="hub-reconnect-btn"
            @click="checkHub()"
          >
            {{ t('workspace.ai.reconnect') }}
          </button>
        </div>

        <div
          v-else-if="aiStore.needsLightweightModel"
          class="hub-disconnect"
        >
          <p class="hub-disconnect-text">
            {{ t('workspace.ai.noModel') }}
          </p>
          <p class="hub-disconnect-note">
            {{ aiStore.statusDetail }}
          </p>
          <button
            class="hub-reconnect-btn"
            @click="openModelManager"
          >
            {{ t('workspace.ai.openModelHub') }}
          </button>
        </div>

        <div
          v-else-if="messages.length === 0"
          class="chat-empty"
        >
          <div class="empty-icon-wrap">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            ><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          </div>
          <p class="empty-title">
            {{ t('workspace.ai.howCanIHelp') }}
          </p>
          <p class="empty-desc">
            {{ t('workspace.ai.description') }}
          </p>
          <div class="quick-actions">
            <button
              class="qa-btn"
              :disabled="!aiStore.isReady || !hasCurrentFile"
              @click="sendMessage(t('workspace.ai.quickSummary'))"
            >
              {{ t('workspace.ai.quickSummary') }}
            </button>
            <button
              class="qa-btn"
              :disabled="!aiStore.isReady || !hasCurrentFile"
              @click="sendMessage(t('workspace.ai.quickGrammar'))"
            >
              {{ t('workspace.ai.quickGrammar') }}
            </button>
            <button
              class="qa-btn"
              :disabled="!aiStore.isReady"
              @click="sendMessage(t('workspace.ai.quickOrganize'))"
            >
              {{ t('workspace.ai.quickOrganize') }}
            </button>
          </div>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-msg"
          :class="msg.role"
        >
          <div class="msg-avatar">
            {{ msg.role === 'user' ? t('workspace.ai.you') : 'M' }}
          </div>
          <div class="msg-body">
            <div
              class="msg-content"
              v-html="renderMessage(msg.content)"
            />
            <span
              v-if="msg.streaming"
              class="cursor-blink"
            />
            <div
              v-if="msg.role === 'assistant' && !msg.streaming"
              class="msg-tools"
            >
              <button
                class="tool-btn"
                @click="copyMessage(msg.content)"
              >
                {{ t('workspace.ai.copy') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="ai-input-area">
        <div class="input-box">
          <textarea
            ref="chatInput"
            v-model="inputText"
            class="ai-textarea"
            :placeholder="t('workspace.ai.inputPlaceholder')"
            rows="1"
            :disabled="!aiStore.isReady"
            @keydown="handleInputKeydown"
            @input="autoResizeInput"
          />
          <button
            class="send-btn"
            :class="{ active: inputText.trim() && aiStore.isReady }"
            :disabled="!inputText.trim() || !aiStore.isReady || chatLoading"
            @click="sendFromInput"
          >
            <span
              v-if="chatLoading"
              class="send-spin"
            />
            <svg
              v-else
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><line
              x1="22"
              y1="2"
              x2="11"
              y2="13"
            /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
        </div>
        <p class="ai-disclaimer">
          {{ t('workspace.ai.disclaimer') }}
        </p>
      </div>
    </aside>

    <PrivacyInterceptor />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FileTree from '@/components/sideBar/FileTree.vue'
import DropZone from '@/components/convert/DropZone.vue'
import PrivacyInterceptor from '@/components/privacy/PrivacyInterceptor.vue'
import { useAIStore } from '@/store/aiStore'
import { useKBStore } from '@/store/kbStore'
import { useMCPStore } from '@/store/mcpStore'
import type { AuditDecisionFilter } from '@/store/mcpStore'
import { useMainStore } from '@/store'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { useProjectStore } from '@/store/project'
import { useListenForMainStore } from '@/store/listenForMain'
import { useAutoUpdatesStore } from '@/store/autoUpdates'
import { useCommandCenterStore } from '@/store/commandCenter'
import { useNotificationStore } from '@/store/notification'
import { addStyles, addThemeStyle, addCustomStyle, type AddStylesOptions } from '@/util/theme'
import { DEFAULT_STYLE } from '@/config'
import bus from '@/bus'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 将 katex 暴露到 window 供 renderMarkdown 使用
;(window as any).katex = katex

// i18n
const { t } = useI18n()

// Stores
const aiStore = useAIStore()
const kbStore = useKBStore()
const mcpStore = useMCPStore()

const auditFilters: Array<{ value: AuditDecisionFilter; label: string }> = [
  { value: 'all', label: t('workspace.audit.all') },
  { value: 'allowed', label: t('workspace.audit.allowed') },
  { value: 'desensitized', label: t('workspace.audit.desensitized') },
  { value: 'rejected', label: t('workspace.audit.rejected') },
  { value: 'timeout', label: t('workspace.audit.timeout') },
]
const mainStore = useMainStore()
const router = useRouter()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const layoutStore = useLayoutStore()
const projectStore = useProjectStore()
const listenForMainStore = useListenForMainStore()
const autoUpdateStore = useAutoUpdatesStore()
const commandCenterStore = useCommandCenterStore()
const notificationStore = useNotificationStore()

const { theme, customCss, zoom } = storeToRefs(preferencesStore)
const hasCurrentFile = computed<boolean>(() => !!currentPreviewPath.value)

// Layout state
const activePanel = ref<'files' | 'search' | 'bookmarks'>('files')
const sidePanelVisible = ref(true)
const aiPanelVisible = ref(false)
const isDark = ref(false)

// 直接预览状态
const currentPreviewPath = ref<string | null>(null)
const previewContent = ref<string | null>(null)
const aiContinuing = ref(false)
const editMode = ref<'preview' | 'edit'>('preview')
const ghostText = ref('')
const ghostStyle = ref<Record<string, string>>({})
const editTextarea = ref<HTMLTextAreaElement | null>(null)
let autocompleteTimer: ReturnType<typeof setTimeout> | null = null
let autocompleteId = 0

// AinCore state
const hubConnected = ref(false)

async function checkHub (): Promise<void> {
  try {
    await aiStore.fetchStatus()
    hubConnected.value = aiStore.coreRunning
  } catch {
    hubConnected.value = false
  }
}

function openSettings (): void {
  window.electron.ipcRenderer.send('mt::open-setting-window')
}

function toggleTheme (): void {
  isDark.value = !isDark.value
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
}

function openModelManager (): void {
  router.push('/models')
}

/**
 * AI 续写：取当前笔记最后 500 字作为上下文，让 AI 继续写
 */
async function aiContinue (): Promise<void> {
  if (!aiStore.isReady || !previewContent.value) return
  aiContinuing.value = true
  try {
    const context = previewContent.value.slice(-500)
    const resp = await aiStore.autocomplete({
      context,
      cursorPosition: context.length,
    })
    if (resp.completion) {
      previewContent.value += resp.completion
      // 保存到文件
      if (currentPreviewPath.value) {
        await window.fileUtils.writeFile(currentPreviewPath.value, previewContent.value)
      }
    }
  } catch (err) {
    console.error(t('workspace.file.aiContinueFailed'), err)
  } finally {
    aiContinuing.value = false
  }
}

/**
 * 编辑模式输入处理
 */
function onEditInput (e: Event): void {
  const target = e.target as HTMLTextAreaElement
  previewContent.value = target.value
  ghostText.value = ''

  // 300ms 防抖后请求自动补全
  if (autocompleteTimer) clearTimeout(autocompleteTimer)
  const currentId = ++autocompleteId
  autocompleteTimer = setTimeout(async () => {
    if (!aiStore.isReady || !previewContent.value) return
    try {
      const text = previewContent.value
      const cursorPos = target.selectionStart
      const context = text.slice(Math.max(0, cursorPos - 300), cursorPos)
      const resp = await aiStore.autocomplete({
        context,
        cursorPosition: context.length,
      })
      if (currentId === autocompleteId && resp.completion) {
        ghostText.value = resp.completion.split('\n')[0] // 只显示第一行
        // 计算 ghost text 位置（光标附近）
        const ta = editTextarea.value
        if (ta) {
          const textBefore = previewContent.value?.slice(0, ta.selectionStart) || ''
          const lines = textBefore.split('\n')
          const line = lines.length - 1
          const col = lines[lines.length - 1].length
          ghostStyle.value = {
            top: (line * 25.5 + 24) + 'px',
            left: (col * 9 + 32) + 'px',
            opacity: '1',
          }
        }
      }
    } catch {
      // 静默失败
    }
  }, 300)
}

/**
 * 编辑模式键盘处理
 */
function onEditKeydown (e: KeyboardEvent): void {
  if (e.key === 'Tab' && ghostText.value) {
    e.preventDefault()
    const textarea = editTextarea.value
    if (textarea && previewContent.value) {
      const pos = textarea.selectionStart
      const accepted = ghostText.value
      ghostText.value = ''
      const before = previewContent.value.slice(0, pos)
      const after = previewContent.value.slice(pos)
      previewContent.value = before + accepted + after
      nextTick(() => {
        textarea.selectionStart = textarea.selectionEnd = pos + accepted.length
      })
    }
  } else if (e.key === 'Escape' && ghostText.value) {
    ghostText.value = ''
  }
}

function togglePanel (panel: 'files' | 'search' | 'bookmarks'): void {
  if (activePanel.value === panel && sidePanelVisible.value) {
    sidePanelVisible.value = false
  } else {
    activePanel.value = panel
    sidePanelVisible.value = true
  }
}

// File actions
function openFolder (): void {
  window.electron.ipcRenderer.send('mt::cmd-open-folder')
}

function handleNewNote (): void {
  if (!kbStore.rootPath) {
    openFolder()
    return
  }
  const parentPath = kbStore.selectedPath && kbStore.selectedNode?.isDirectory
    ? kbStore.selectedPath
    : kbStore.rootPath
  kbStore.createNote(parentPath, t('workspace.file.unnamedNote'))
}

function handleNewFolder (): void {
  if (!kbStore.rootPath) {
    openFolder()
    return
  }
  const parentPath = kbStore.selectedPath && kbStore.selectedNode?.isDirectory
    ? kbStore.selectedPath
    : kbStore.rootPath
  kbStore.createFolder(parentPath, t('workspace.file.newFolder'))
}

// Search
const globalSearchText = ref('')

function handleGlobalSearch (): void {
  kbStore.search(globalSearchText.value)
}

async function openSearchResult (path: string): Promise<void> {
  if (!path.endsWith('.md')) return
  currentPreviewPath.value = path
  previewContent.value = null
  try {
    const content = await window.fileUtils.readFile(path, 'utf-8')
    previewContent.value = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content as Uint8Array)
  } catch (err) {
    previewContent.value = t('workspace.file.readError', { error: String(err) })
  }
}

async function onFileConverted (path: string): Promise<void> {
  if (path.endsWith('.md')) {
    currentPreviewPath.value = path
    try {
      const content = await window.fileUtils.readFile(path, 'utf-8')
      previewContent.value = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content as Uint8Array)
    } catch (err) {
      previewContent.value = t('workspace.file.readError', { error: String(err) })
    }
  }
}

// AI Chat
const inputText = ref('')
const chatLoading = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const chatInput = ref<HTMLTextAreaElement | null>(null)

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

const messages = ref<ChatMessage[]>([])

function startNewChat (): void {
  messages.value = []
  inputText.value = ''
  chatLoading.value = false
}

function scrollChatToBottom (): void {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

function renderMessage (content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    .replace(/\n/g, '<br>')
}

/**
 * 简单 Markdown 渲染（用于文件预览）
 * 支持 KaTeX 数学公式
 */
function renderMarkdown (content: string): string {
  if (!content) return ''

  // 先提取数学公式，避免被其他规则破坏
  const mathBlocks: string[] = []
  let processed = content

  // $$...$$ 块级公式
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_match, tex) => {
    const idx = mathBlocks.length
    try {
      mathBlocks.push(window.katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }))
    } catch {
      mathBlocks.push(`<code>${tex}</code>`)
    }
    return `%%MATH_BLOCK_${idx}%%`
  })

  // \[...\] 块级公式
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, tex) => {
    const idx = mathBlocks.length
    try {
      mathBlocks.push(window.katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }))
    } catch {
      mathBlocks.push(`<code>${tex}</code>`)
    }
    return `%%MATH_BLOCK_${idx}%%`
  })

  // $...$ 行内公式（不匹配 $$）
  processed = processed.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_match, tex) => {
    const idx = mathBlocks.length
    try {
      mathBlocks.push(window.katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }))
    } catch {
      mathBlocks.push(`<code>${tex}</code>`)
    }
    return `%%MATH_BLOCK_${idx}%%`
  })

  // \(...\) 行内公式
  processed = processed.replace(/\\\((.+?)\\\)/g, (_match, tex) => {
    const idx = mathBlocks.length
    try {
      mathBlocks.push(window.katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }))
    } catch {
      mathBlocks.push(`<code>${tex}</code>`)
    }
    return `%%MATH_BLOCK_${idx}%%`
  })

  // Markdown 渲染
  let html = processed
    // 标题
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗体/斜体
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // 行内代码
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 无序列表
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // 有序列表
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // 分割线
    .replace(/^---$/gm, '<hr>')
    // 删除线
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // 段落
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')

  // 还原数学公式
  for (let i = 0; i < mathBlocks.length; i++) {
    html = html.replace(`%%MATH_BLOCK_${i}%%`, mathBlocks[i])
  }

  return `<p>${html}</p>`
}

function copyMessage (content: string): void {
  navigator.clipboard.writeText(content)
}

async function sendMessage (text: string): Promise<void> {
  if (!text.trim() || !aiStore.isReady) return
  messages.value.push({ role: 'user', content: text.trim() })
  inputText.value = ''
  scrollChatToBottom()

  const assistantMsg: ChatMessage = { role: 'assistant', content: '', streaming: true }
  messages.value.push(assistantMsg)
  scrollChatToBottom()
  chatLoading.value = true

  try {
    const lc = text.toLowerCase()
    let response = ''

    if (lc.includes('总结') || lc.includes('summarize') || lc.includes('summary')) {
      if (!previewContent.value) {
        response = t('workspace.chat.noNoteForSummary')
      } else {
        const resp = await aiStore.summarize({ text: previewContent.value, maxLength: 120 })
        response = resp.summary
      }
    } else if (lc.includes('语法') || lc.includes('grammar') || lc.includes('检查')) {
      if (!previewContent.value) {
        response = t('workspace.chat.noNoteForGrammar')
      } else {
        const resp = await aiStore.correctGrammar({ text: previewContent.value })
        if (resp.changes.length === 0) {
          response = t('workspace.chat.noGrammarIssues')
        } else {
          response = t('workspace.chat.foundIssues', { count: resp.changes.length }) + '\n\n'
          for (const c of resp.changes.slice(0, 10)) {
            response += `~~${c.original}~~ → \`${c.replacement}\`\n`
          }
        }
      }
    } else if (lc.includes('整理') || lc.includes('organize')) {
      const notes = await kbStore.getNotesForOrganization()
      if (notes.length === 0) {
        response = t('workspace.chat.noNotesFound')
      } else {
        const s = await aiStore.organize({ notes })
        if (s.suggestions.length === 0) {
          response = t('workspace.chat.notesOrganized')
        } else {
          response = t('workspace.chat.organizeSuggestions', { count: String(notes.length) }) + '\n\n'
          for (const g of s.suggestions) {
            response += `**${g.folderName}** (${g.notes.length})\n${g.reason}\n\n`
          }
        }
      }
    } else {
      // 通用回复：传递笔记内容给 AI 进行上下文相关回答
      try {
        const resp = await aiStore.chatWithContext({
          message: text,
          noteContent: previewContent.value || '',
          notePath: currentPreviewPath.value || undefined,
        })
        response = resp.reply || t('workspace.chat.cannotUnderstand')
      } catch {
        response = t('workspace.chat.aiUnavailable')
      }
    }

    // Stream the response in chunks for smooth visual effect
    assistantMsg.content = ''
    const CHUNK_SIZE = 4
    const FRAME_MS = 16 // ~60fps
    for (let i = 0; i < response.length; i += CHUNK_SIZE) {
      assistantMsg.content += response.slice(i, i + CHUNK_SIZE)
      scrollChatToBottom()
      await new Promise(resolve => setTimeout(resolve, FRAME_MS))
    }
    assistantMsg.content = response // Ensure complete text
    assistantMsg.streaming = false
    scrollChatToBottom()
  } catch {
    assistantMsg.content = t('workspace.chat.tryAgain')
    assistantMsg.streaming = false
  } finally {
    chatLoading.value = false
  }
}

function sendFromInput (): void {
  sendMessage(inputText.value)
}

function handleInputKeydown (e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendFromInput()
  }
}

function autoResizeInput (): void {
  const el = chatInput.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

// ---- Global keyboard shortcuts ----
function handleGlobalKeydown (e: KeyboardEvent): void {
  const mod = e.metaKey || e.ctrlKey
  if (!mod) return

  // Cmd/Ctrl+1 — 文件面板
  if (e.key === '1') {
    e.preventDefault()
    activePanel.value = 'files'
    sidePanelVisible.value = true
  } else if (e.key === '2') {
    e.preventDefault()
    activePanel.value = 'search'
    sidePanelVisible.value = true
  } else if (e.key === '3') {
    e.preventDefault()
    aiPanelVisible.value = !aiPanelVisible.value
  } else if (e.key === 'k') {
    e.preventDefault()
    activePanel.value = 'search'
    sidePanelVisible.value = true
  } else if (e.key === 'n') {
    e.preventDefault()
    handleNewNote()
  } else if (e.key === 'b') {
    e.preventDefault()
    sidePanelVisible.value = !sidePanelVisible.value
  }
  // Escape — 关闭 AI 面板
  if (e.key === 'Escape' && aiPanelVisible.value) {
    e.preventDefault()
    aiPanelVisible.value = false
  }
}

function formatSpeed (b?: number): string {
  if (!b) return ''
  if (b < 1024) return `${b.toFixed(0)} B/s`
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB/s`
  return `${(b / 1048576).toFixed(1)} MB/s`
}

function formatAuditDecision (decision: 'allowed' | 'rejected' | 'desensitized' | 'timeout'): string {
  return t(`workspace.audit.${decision}`)
}

// Theme watchers
watch(theme, (v, old) => { if (v !== old) addThemeStyle(v) })
watch(customCss, (v, old) => { if (v !== old) addCustomStyle({ customCss: v }) })
watch(zoom, (z) => { bus.emit('mt::window-zoom', z) })

onMounted(async () => {
  if (window.aincoreNotes?.initialState) {
    preferencesStore.SET_USER_PREFERENCE(window.aincoreNotes.initialState)
  }
  mainStore.LISTEN_WIN_STATUS()
  await commandCenterStore.LISTEN_COMMAND_CENTER_BUS()
  layoutStore.LISTEN_FOR_LAYOUT()
  listenForMainStore.LISTEN_FOR_EDIT()
  preferencesStore.LISTEN_FOR_VIEW()
  listenForMainStore.LISTEN_FOR_SHOW_DIALOG()
  listenForMainStore.LISTEN_FOR_PARAGRAPH_INLINE_STYLE()
  projectStore.LISTEN_FOR_UPDATE_PROJECT()
  projectStore.LISTEN_FOR_LOAD_PROJECT()
  projectStore.LISTEN_FOR_SIDEBAR_CONTEXT_MENU()
  autoUpdateStore.LISTEN_FOR_UPDATE()
  preferencesStore.ASK_FOR_USER_PREFERENCE()
  preferencesStore.LISTEN_TOGGLE_VIEW()
  editorStore.LISTEN_SCREEN_SHOT()
  editorStore.LISTEN_FOR_CLOSE()
  editorStore.LISTEN_FOR_SAVE_AS()
  editorStore.LISTEN_FOR_MOVE_TO()
  editorStore.LISTEN_FOR_SAVE()
  editorStore.LISTEN_FOR_SET_PATHNAME()
  editorStore.LISTEN_FOR_BOOTSTRAP_WINDOW()
  editorStore.LISTEN_FOR_SAVE_CLOSE()
  editorStore.LISTEN_FOR_RENAME()
  editorStore.LISTEN_FOR_SET_LINE_ENDING()
  editorStore.LISTEN_FOR_SET_ENCODING()
  editorStore.LISTEN_FOR_SET_FINAL_NEWLINE()
  editorStore.LISTEN_FOR_NEW_TAB()
  editorStore.LISTEN_FOR_CLOSE_TAB()
  editorStore.LISTEN_FOR_TAB_CYCLE()
  editorStore.LISTEN_FOR_SWITCH_TABS()
  editorStore.LISTEN_FOR_PRINT_SERVICE_CLEARUP()
  editorStore.LISTEN_FOR_EXPORT_SUCCESS()
  editorStore.LISTEN_FOR_FILE_CHANGE()
  editorStore.LISTEN_WINDOW_ZOOM()
  editorStore.LISTEN_FOR_RELOAD_IMAGES()
  editorStore.LISTEN_FOR_CONTEXT_MENU()
  editorStore.LISTEN_FOR_STATE_REPLACE()
  notificationStore.listenForNotification()

  aiStore.setupListeners()
  aiStore.fetchStatus()
  mcpStore.setupListeners()
  mcpStore.fetchStatus()
  checkHub() // 检查 AinCore 连接状态

  // 全局快捷键
  document.addEventListener('keydown', handleGlobalKeydown)

  // Bridge: when AinCore Notes opens a directory, sync it to kbStore
  const offOpenDirectory = window.electron.ipcRenderer.on('mt::open-directory', (_e: unknown, pathname: unknown) => {
    kbStore.setRootPath(String(pathname))
  })

  // Bridge: when a file is selected in the file tree, read and preview it
  watch(() => kbStore.selectedPath, async (path) => {
    if (!path) {
      currentPreviewPath.value = null
      previewContent.value = null
      return
    }
    // 只预览 .md 文件
    if (!path.endsWith('.md')) return

    currentPreviewPath.value = path
    previewContent.value = null // 先清空，显示"加载中"

    try {
      const content = await window.fileUtils.readFile(path, 'utf-8')
      previewContent.value = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content as Uint8Array)
    } catch (err) {
      previewContent.value = t('workspace.file.readError', { error: String(err) })
    }
  })

  nextTick(() => {
    const init = window.aincoreNotes?.initialState
    const style: AddStylesOptions = {
      theme: init?.theme ?? DEFAULT_STYLE.theme,
      codeFontFamily: init?.codeFontFamily ?? DEFAULT_STYLE.codeFontFamily,
      codeFontSize: init?.codeFontSize ?? DEFAULT_STYLE.codeFontSize,
      hideScrollbar: init?.hideScrollbar ?? DEFAULT_STYLE.hideScrollbar
    }
    addStyles(style)
  })
})

onUnmounted(() => {
  aiStore.cleanup()
  mcpStore.cleanup()
  document.removeEventListener('keydown', handleGlobalKeydown)
  offOpenDirectory?.()
})
</script>

<style scoped>
/* ========== Layout ========== */
.aincore-workspace {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #fff;
  color: #1a1a1a;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
  position: absolute;
  inset: 0;
}

/* ========== 1. Nav Rail ========== */
.nav-rail {
  width: 48px;
  min-width: 48px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  background: #f7f7f7;
  border-right: 1px solid #e5e5e5;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.nav-top, .nav-bottom {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.12s;
}

.nav-icon:hover {
  background: #ebebeb;
  color: #555;
}

.nav-icon.active {
  background: #e8f0fe;
  color: #1a73e8;
}

.nav-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34a853;
  border: 1.5px solid #f7f7f7;
}

/* ========== 2. Side Panel ========== */
.side-panel {
  width: 260px;
  min-width: 200px;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-right: 1px solid #e5e5e5;
  flex-shrink: 0;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
}

.panel-actions {
  display: flex;
  gap: 2px;
}

.panel-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.1s;
}

.panel-btn:hover {
  background: #ebebeb;
  color: #555;
}

.panel-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #aaa;
  font-size: 13px;
}

.panel-footer {
  padding: 8px 14px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.footer-text {
  font-size: 11px;
  color: #aaa;
}

/* Search panel */
.search-panel-body {
  padding: 10px 14px;
  flex: 1;
  overflow-y: auto;
}

.global-search-input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  color: #1a1a1a;
  background: #fff;
  outline: none;
  box-sizing: border-box;
}

.global-search-input:focus {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.1);
}

.global-search-input::placeholder {
  color: #bbb;
}

.search-results-list {
  margin-top: 10px;
}

.search-result {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2px;
}

.search-result:hover {
  background: #f0f0f0;
}

.sr-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #1a1a1a;
}

.sr-snippet {
  display: block;
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========== 3. Editor ========== */
.editor-area {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Welcome */
.welcome-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.welcome-hint {
  font-size: 14px;
  color: #aaa;
}

/* Preview Area */
.preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  min-height: 0;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
  flex-shrink: 0;
}

.preview-filename {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.preview-path {
  font-size: 11px;
  color: #aaa;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.preview-ai-btn {
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 5px 14px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}

.preview-ai-btn:hover { background: #1557b0; }
.preview-ai-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.preview-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.preview-mode-btn {
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  color: #888;
  cursor: pointer;
}

.preview-mode-btn:hover { background: #f5f5f5; }
.preview-mode-btn.active { background: #e8f0fe; color: #1a73e8; border-color: #1a73e8; }

/* Edit mode */
.edit-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.edit-textarea {
  width: 100%;
  height: 100%;
  padding: 24px 32px;
  border: none;
  outline: none;
  resize: none;
  font-size: 15px;
  line-height: 1.7;
  color: #333;
  background: #fff;
  font-family: inherit;
  max-width: 780px;
}

.edit-textarea::placeholder { color: #ccc; }

/* Ghost text overlay */
.ghost-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  color: rgba(0, 0, 0, 0.25);
  font-size: 15px;
  line-height: 1.7;
  font-family: inherit;
  white-space: pre-wrap;
}

.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  font-size: 15px;
  line-height: 1.7;
  color: #333;
  max-width: 780px;
}

.preview-body :deep(h1) {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 16px;
  color: #1a1a1a;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.preview-body :deep(h2) {
  font-size: 22px;
  font-weight: 600;
  margin: 24px 0 12px;
  color: #1a1a1a;
}

.preview-body :deep(h3) {
  font-size: 18px;
  font-weight: 600;
  margin: 20px 0 8px;
  color: #333;
}

.preview-body :deep(p) {
  margin: 0 0 12px;
}

.preview-body :deep(strong) {
  font-weight: 600;
  color: #1a1a1a;
}

.preview-body :deep(code) {
  background: #f1f3f4;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 13px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  color: #d93025;
}

.preview-body :deep(a) {
  color: #1a73e8;
  text-decoration: none;
}

.preview-body :deep(a:hover) {
  text-decoration: underline;
}

.preview-body :deep(li) {
  margin: 4px 0;
  padding-left: 8px;
  list-style: disc inside;
}

.preview-body :deep(hr) {
  border: none;
  border-top: 1px solid #eee;
  margin: 20px 0;
}

.preview-body :deep(del) {
  color: #999;
}

/* ========== 4. AI Chat Panel ========== */
.ai-panel {
  width: 360px;
  min-width: 300px;
  border-left: 1px solid #e5e5e5;
  display: flex;
  flex-direction: column;
  background: #fff;
  flex-shrink: 0;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.ai-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-logo {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #1a73e8;
  color: white;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.ai-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-pill {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.ai-pill.ready {
  background: #e6f4ea;
  color: #137333;
}

.ai-pill.starting {
  background: #fef7e0;
  color: #b06000;
}

.ai-pill.stopped, .ai-pill.error {
  background: #f1f3f4;
  color: #888;
}

.ai-pill.hub-connected {
  background: #e6f4ea;
  color: #137333;
}

/* Download bar */
.ai-dl-bar {
  padding: 8px 14px;
  border-bottom: 1px solid #eee;
}

.dl-track {
  height: 3px;
  background: #e8eaed;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 5px;
}

.dl-fill {
  height: 100%;
  background: #1a73e8;
  border-radius: 2px;
  transition: width 0.3s;
}

.dl-text {
  font-size: 11px;
  color: #888;
}

.sentinel-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 14px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.sentinel-pill {
  font-size: 11px;
  line-height: 1;
  padding: 5px 8px;
  border-radius: 6px;
  color: #666;
  background: #fff;
  border: 1px solid #eee;
}

.sentinel-pill.active {
  color: #9a5b00;
  background: #fff8e8;
  border-color: #f5d7a1;
}

.audit-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 14px;
  border-bottom: 1px solid #eee;
  background: #fff;
}

.audit-head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.audit-title {
  font-size: 11px;
  font-weight: 600;
  color: #555;
}

.audit-filters {
  display: flex;
  gap: 4px;
  overflow: hidden;
}

.audit-filter,
.audit-clear {
  border: 1px solid #eee;
  border-radius: 5px;
  background: #fff;
  color: #777;
  font-size: 10px;
  line-height: 1;
  padding: 4px 6px;
  cursor: pointer;
  white-space: nowrap;
}

.audit-filter.active {
  color: #1a73e8;
  border-color: #c8dcfb;
  background: #eef5ff;
}

.audit-clear:hover,
.audit-filter:hover {
  background: #f8f9fa;
}

.audit-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) minmax(70px, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  font-size: 11px;
  color: #777;
}

.audit-tool,
.audit-client {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-decision {
  color: #333;
  font-weight: 600;
}

.audit-pii {
  color: #9a5b00;
  background: #fff8e8;
  border-radius: 4px;
  padding: 2px 5px;
}

/* Chat */
.ai-chat {
  flex: 1;
  overflow-y: auto;
}

.hub-disconnect {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 24px;
  text-align: center;
}

.hub-disconnect-text {
  font-size: 14px;
  color: #888;
  margin: 0 0 14px;
}

.hub-reconnect-btn {
  background: #1a73e8;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.hub-reconnect-btn:hover {
  background: #1557b0;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 24px;
  text-align: center;
}

.empty-icon-wrap {
  color: #ccc;
  margin-bottom: 14px;
}

.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
  margin: 0 0 6px;
}

.empty-desc {
  font-size: 13px;
  color: #888;
  margin: 0 0 22px;
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.qa-btn {
  background: #f1f3f4;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  padding: 5px 14px;
  font-size: 12px;
  color: #444;
  cursor: pointer;
  transition: all 0.1s;
}

.qa-btn:hover:not(:disabled) {
  background: #e8eaed;
  border-color: #ccc;
}

.qa-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* Messages */
.chat-msg {
  display: flex;
  gap: 10px;
  padding: 14px 14px;
  border-bottom: 1px solid #f5f5f5;
  animation: slideIn 0.15s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.chat-msg.user .msg-avatar {
  background: #f1f3f4;
  color: #888;
}

.chat-msg.assistant .msg-avatar {
  background: #1a73e8;
  color: white;
}

.msg-body { flex: 1; min-width: 0; }

.msg-content {
  font-size: 13.5px;
  line-height: 1.65;
  color: #333;
  word-break: break-word;
}

.msg-content :deep(strong) { font-weight: 600; color: #1a1a1a; }
.msg-content :deep(code) {
  background: #f1f3f4;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: 'SF Mono', Monaco, Consolas, monospace;
  color: #d93025;
}
.msg-content :deep(del) { color: #d93025; text-decoration: line-through; }

.cursor-blink {
  display: inline-block;
  width: 5px;
  height: 13px;
  background: #1a73e8;
  border-radius: 1px;
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink 0.8s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.msg-tools {
  margin-top: 6px;
  display: flex;
  gap: 6px;
}

.tool-btn {
  background: none;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #888;
  cursor: pointer;
}

.tool-btn:hover {
  color: #555;
  border-color: #ccc;
}

/* Input */
.ai-input-area {
  padding: 10px 14px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 8px 10px 8px 14px;
  transition: border-color 0.12s;
}

.input-box:focus-within {
  border-color: #1a73e8;
  box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.08);
}

.ai-textarea {
  flex: 1;
  background: none;
  border: none;
  color: #1a1a1a;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 20px;
  max-height: 100px;
  font-family: inherit;
}

.ai-textarea::placeholder { color: #bbb; }

.send-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: #e8eaed;
  color: #aaa;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.12s;
}

.send-btn.active {
  background: #1a73e8;
  color: white;
  cursor: pointer;
}

.send-btn.active:hover { background: #1557b0; }

.send-spin {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.ai-disclaimer {
  font-size: 10px;
  color: #ccc;
  text-align: center;
  margin: 5px 0 0;
}
</style>

<!-- Global theme overrides -->
<style>
:root {
  --themeColor: #1a73e8;
  --sideBarBgColor: #fafafa;
  --editorBgColor: #ffffff;
  --editorColor: #1a1a1a;
  --editorColor50: #888888;
  --sideBarBorderColor: #e5e5e5;
  --sideBarColor: #888888;
  --sideBarHoverColor: #ebebeb;
}

/* Dark theme */
[data-theme="dark"] {
  --themeColor: #5b9bf5;
  --sideBarBgColor: #1e1e1e;
  --editorBgColor: #121212;
  --editorColor: #e0e0e0;
  --editorColor50: #888888;
  --sideBarBorderColor: #333333;
  --sideBarColor: #888888;
  --sideBarHoverColor: #2a2a2a;
}
</style>
