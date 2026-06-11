<template>
  <Teleport to="body">
    <Transition name="popup">
      <div
        v-if="store.hasPendingPopup"
        class="privacy-overlay"
      >
        <div class="privacy-popup">
          <div class="popup-header">
            <div class="header-icon">
              🛡️
            </div>
            <div class="header-text">
              <h3>{{ t('privacyPopup.title') }}</h3>
              <p class="client-name">
                {{ t('privacyPopup.source') }}<strong>{{ popup?.request.clientName || t('privacyPopup.unknown') }}</strong>
              </p>
            </div>
            <div
              class="countdown"
              :class="{ urgent: store.countdown <= 10 }"
            >
              {{ store.countdown }}s
            </div>
          </div>

          <div class="popup-body">
            <div class="request-info">
              <span class="info-label">{{ t('privacyPopup.tool') }}</span>
              <code class="tool-name">{{ popup?.request.tool }}</code>
            </div>

            <div
              v-if="popup?.preview"
              class="preview-section"
            >
              <div class="preview-header">
                <span class="info-label">{{ t('privacyPopup.dataPreview') }}</span>
                <span
                  v-if="popup.preview.entitiesFound.length"
                  class="pii-badge"
                >
                  {{ t('privacyPopup.blockedItems', { count: popup.preview.entitiesFound.length }) }}
                </span>
              </div>
              <pre class="data-preview">{{ popup.preview.masked }}</pre>
            </div>

            <div
              v-if="popup?.request.args"
              class="args-section"
            >
              <span class="info-label">{{ t('privacyPopup.params') }}</span>
              <pre class="args-preview">{{ JSON.stringify(popup.request.args, null, 2) }}</pre>
            </div>
          </div>

          <div class="popup-footer">
            <button
              class="btn btn-reject"
              @click="store.rejectPopup()"
            >
              {{ t('privacyPopup.reject') }}
            </button>
            <button
              class="btn btn-desensitize"
              @click="handleDesensitize"
            >
              {{ t('privacyPopup.desensitize') }}
            </button>
            <button
              class="btn btn-allow"
              @click="store.acceptPopup()"
            >
              {{ t('privacyPopup.allow') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMCPStore } from '@/store/mcpStore'

const { t } = useI18n()
const store = useMCPStore()
const popup = computed(() => store.pendingPopup)

/**
 * 脱敏后传输：用脱敏后的 masked 数据替换 original 后批准传输
 */
function handleDesensitize (): void {
  store.acceptDesensitized()
}

onMounted(() => {
  store.setupListeners()
  store.fetchStatus()
})

onUnmounted(() => {
  store.cleanup()
})
</script>

<style scoped>
.privacy-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.privacy-popup {
  background: var(--surface-1, #1a1a1a);
  border: 1px solid var(--border-color, #333);
  border-radius: 12px;
  width: 520px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.popup-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #333);
}

.header-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.header-text h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #eee);
}

.client-name {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary, #999);
}

.countdown {
  margin-left: auto;
  font-size: 20px;
  font-weight: 700;
  color: var(--accent-color, #4a9eff);
  font-variant-numeric: tabular-nums;
}

.countdown.urgent {
  color: var(--error-color, #f44336);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.popup-body {
  padding: 16px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.request-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-size: 12px;
  color: var(--text-secondary, #999);
  flex-shrink: 0;
}

.tool-name {
  background: var(--surface-2, rgba(255, 255, 255, 0.08));
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent-color, #4a9eff);
}

.preview-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pii-badge {
  font-size: 11px;
  background: var(--warning-bg, rgba(240, 160, 32, 0.15));
  color: var(--warning-color, #f0a020);
  padding: 2px 8px;
  border-radius: 10px;
}

.data-preview {
  background: var(--surface-2, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, #333);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-primary, #eee);
  max-height: 200px;
  overflow-y: auto;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.args-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.args-preview {
  background: var(--surface-2, rgba(255, 255, 255, 0.05));
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--text-secondary, #999);
  max-height: 100px;
  overflow-y: auto;
  margin: 0;
}

.popup-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-color, #333);
}

.btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn:hover { opacity: 0.85; }

.btn-reject {
  background: transparent;
  border: 1px solid var(--error-color, #f44336);
  color: var(--error-color, #f44336);
}

.btn-reject:hover {
  background: rgba(244, 67, 54, 0.1);
  opacity: 1;
}

.btn-desensitize {
  background: transparent;
  border: 1px solid var(--warning-color, #f0a020);
  color: var(--warning-color, #f0a020);
}

.btn-desensitize:hover {
  background: rgba(240, 160, 32, 0.1);
  opacity: 1;
}

.btn-allow {
  background: var(--accent-color, #4a9eff);
  border: 1px solid var(--accent-color, #4a9eff);
  color: white;
}

/* Transition */
.popup-enter-active { transition: all 0.2s ease-out; }
.popup-leave-active { transition: all 0.15s ease-in; }
.popup-enter-from { opacity: 0; transform: scale(0.95) translateY(-10px); }
.popup-leave-to { opacity: 0; transform: scale(0.95); }
</style>
