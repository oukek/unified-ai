<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChatStore } from '@/stores/chatStore'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/utils'

// Get the app store for error handling
const appStore = useAppStore()

// Get the chat store
const chatStore = useChatStore()

// Model value for the selector
const modelValue = ref(chatStore.selectedModel)

// 显示设置弹窗
const showSettingsModal = ref(false)
// API Key
const apiKey = ref('')
// API Key 设置状态
const apiKeyIsSet = ref(false)
// API Key 设置加载状态
const settingsLoading = ref(false)

// Watch for changes to update store
watch(modelValue, (newValue: string) => {
  chatStore.selectedModel = newValue
})

// 打开设置弹窗
const openSettings = async () => {
  showSettingsModal.value = true
  await checkApiKeyStatus()
}

// 关闭设置弹窗
const closeSettings = () => {
  showSettingsModal.value = false
}

// 检查API Key设置状态
const checkApiKeyStatus = async () => {
  try {
    settingsLoading.value = true
    const response = await api.get('/api/ai/settings/apikey/status')
    const data = response.data
    apiKeyIsSet.value = data.isSet
  } catch (err) {
    console.error('获取API密钥状态失败:', err)
  } finally {
    settingsLoading.value = false
  }
}

// 保存API Key
const saveApiKey = async () => {
  if (!apiKey.value.trim()) return

  try {
    settingsLoading.value = true
    const response = await api.post('/api/ai/settings/apikey', { apiKey: apiKey.value })
    const data = response.data

    if (data.success) {
      apiKeyIsSet.value = true
      apiKey.value = ''
      closeSettings()
    } else {
      appStore.showError(data.error || '设置API密钥失败')
    }
  } catch (err) {
    console.error('设置API密钥失败:', err)
    appStore.showError('设置API密钥失败')
  } finally {
    settingsLoading.value = false
  }
}
</script>

<template>
  <div class="sidebar">
    <!-- 新聊天按钮 -->
    <button class="new-chat-button" @click="chatStore.startNewChat">
      <span>+ 新建聊天</span>
    </button>

    <!-- 历史记录列表 -->
    <div class="sidebar-history" v-if="chatStore.historyList.length > 0 || chatStore.historyLoading">
      <div v-if="chatStore.historyLoading" class="history-loading-sidebar">
        <div class="loading-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>

      <div v-else class="history-list">
        <div
          v-for="history in chatStore.historyList"
          :key="history.id"
          class="history-item"
          :class="{ 'active': chatStore.currentHistoryId === history.id }"
          @click="chatStore.loadHistoryDetail(history.id)"
        >
          <div class="history-item-title">{{ history.preview || '新对话' }}</div>
          <div class="history-item-info">{{ new Date(history.updatedAt).toLocaleString() }}</div>
          <button @click.stop="chatStore.deleteHistory(history.id)" class="history-delete-btn-small" title="删除">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <div class="history-actions">
          <button @click="chatStore.clearAllHistory" class="clear-history-button">清空历史记录</button>
        </div>
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="sidebar-footer">
      <div class="model-selector">
        <select v-model="modelValue">
          <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
        </select>
      </div>

      <!-- 设置按钮 -->
      <button class="settings-button" @click="openSettings">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
        </svg>
        <span>设置</span>
      </button>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettingsModal" class="settings-modal-overlay">
      <div class="settings-modal">
        <div class="settings-modal-header">
          <h2>设置</h2>
          <button class="close-button" @click="closeSettings">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"></path>
            </svg>
          </button>
        </div>
        <div class="settings-modal-content">
          <div class="settings-section">
            <h3 class="settings-section-title">API 设置</h3>
            <div v-if="apiKeyIsSet" class="api-key-status">
              <div class="status-message success">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#10a37f"></path>
                </svg>
                <span>API 密钥已设置</span>
              </div>
              <p>您可以更新API密钥:</p>
            </div>

            <div class="api-key-input-container">
              <label for="api-key">Gemini API 密钥</label>
              <input
                id="api-key"
                type="password"
                v-model="apiKey"
                placeholder="输入您的 Gemini API 密钥"
                :disabled="settingsLoading"
              />
            </div>
          </div>

          <div class="settings-section">
            <h3 class="settings-section-title">界面设置</h3>
            <div class="setting-item">
              <label class="setting-label">
                <input type="checkbox" v-model="chatStore.enableTypingEffect">
                <span>启用打字机效果</span>
              </label>
              <p class="setting-description">启用后，AI回复会以打字机效果逐字显示</p>
            </div>
          </div>

          <div class="settings-modal-footer">
            <button @click="closeSettings" class="cancel-button" :disabled="settingsLoading">取消</button>
            <button
              @click="saveApiKey"
              class="save-button"
              :disabled="!apiKey.trim() || settingsLoading"
            >
              <span v-if="settingsLoading">保存中...</span>
              <span v-else>保存</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 260px;
  background-color: #202123;
  color: white;
  display: flex;
  flex-direction: column;
  padding: 15px;
  overflow-y: auto;
}

.new-chat-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background-color: #343541;
  border: 1px solid #565869;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  margin-bottom: 20px;
  transition: background-color 0.3s;
}

.new-chat-button:hover {
  background-color: #40414f;
}

/* 历史记录列表 */
.history-list {
  margin-bottom: 15px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.history-list-title {
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
  padding-left: 5px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.history-item {
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 5px;
  transition: background-color 0.2s;
}

.history-item:hover {
  background-color: #343541;
}

.history-item.active {
  background-color: #40414f;
}

.history-item-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-item-info {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.history-actions {
  margin-top: 10px;
  text-align: center;
}

.clear-history-button {
  background-color: transparent;
  border: 1px solid #565869;
  color: #999;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.clear-history-button:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid #404040;
}

.model-selector {
  width: 100%;
  margin-bottom: 10px;
}

.model-selector select {
  width: 100%;
  padding: 8px;
  background-color: #343541;
  color: white;
  border: 1px solid #565869;
  border-radius: 4px;
}

.settings-button, .system-message-button {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  background-color: transparent;
  color: white;
  border: 1px solid #565869;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  margin-bottom: 10px;
}

.settings-button:hover, .system-message-button:hover {
  background-color: #40414f;
}

.history-loading-sidebar {
  display: flex;
  justify-content: center;
  padding: 10px;
}

.loading-indicator {
  display: flex;
  gap: 4px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #888;
  animation: pulse 1.5s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.5s;
}

.dot:nth-child(3) {
  animation-delay: 1s;
}

.history-delete-btn-small {
  visibility: hidden;
  background: transparent;
  border: none;
  color: #888;
  padding: 2px;
  border-radius: 2px;
  margin-left: auto;
}

.history-item:hover .history-delete-btn-small {
  visibility: visible;
}

.history-delete-btn-small:hover {
  background-color: rgba(255, 0, 0, 0.1);
  color: #ff6b6b;
}

/* 设置弹窗样式 */
.settings-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-modal {
  width: 100%;
  max-width: 500px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  color: #333;
}

.settings-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #e5e5e5;
}

.settings-modal-header h2 {
  margin: 0;
  font-size: 18px;
}

.close-button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}

.settings-modal-content {
  padding: 20px;
  overflow-y: auto;
}

.settings-section {
  margin-bottom: 25px;
}

.settings-section-title {
  font-size: 16px;
  margin: 0 0 15px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.setting-item {
  margin-bottom: 15px;
}

.setting-label {
  display: flex;
  align-items: center;
  font-weight: 500;
  margin-bottom: 5px;
  cursor: pointer;
}

.setting-label input {
  margin-right: 8px;
}

.setting-description {
  margin: 5px 0 0 24px;
  font-size: 13px;
  color: #666;
}

.api-key-status {
  margin-bottom: 20px;
}

.status-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.status-message.success {
  color: #10a37f;
}

.api-key-input-container {
  margin-bottom: 20px;
}

.api-key-input-container label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.api-key-input-container input {
  width: calc(100% - 20px);
  padding: 10px;
  border: 1px solid #d9d9e3;
  border-radius: 4px;
  font-size: 16px;
}

.settings-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.cancel-button {
  padding: 8px 16px;
  background-color: #f0f0f5;
  border: 1px solid #d9d9e3;
  border-radius: 4px;
  color: #666;
  cursor: pointer;
}

.save-button {
  padding: 8px 16px;
  background-color: #10a37f;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.save-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
</style>
