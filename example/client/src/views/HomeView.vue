<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { socketService, api } from '@/utils'

interface FunctionCall {
  name: string
  arguments: any
  result?: any
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  functionCalls?: FunctionCall[]
  showFunctions?: boolean
  model?: string
}

// 聊天消息
const messages = ref<Message[]>([])
// 用户输入
const userInput = ref('')
// 加载状态
const loading = ref(false)
// 错误消息
const error = ref('')
// 当前选中的模型
const selectedModel = ref('gemini-2.0-flash')
// 打字机效果控制
const typing = ref<{messageId: string, text: string, index: number, timer: any} | null>(null)
// 显示设置弹窗
const showSettingsModal = ref(false)
// API Key
const apiKey = ref('')
// API Key 设置状态
const apiKeyIsSet = ref(false)
// API Key 设置加载状态
const settingsLoading = ref(false)

// 自动滚动到底部
const chatContainer = ref<HTMLElement | null>(null)
const scrollToBottom = () => {
  setTimeout(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  }, 100)
}

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2)
}

// 打字机效果函数
const startTypingEffect = (messageId: string, text: string) => {
  // 清除之前的定时器
  if (typing.value && typing.value.timer) {
    clearInterval(typing.value.timer)
  }

  // 找到消息并设置初始文本为空
  const message = messages.value.find(m => m.id === messageId)
  if (message) {
    message.content = ''
  }

  // 设置打字机状态
  typing.value = {
    messageId,
    text,
    index: 0,
    timer: null
  }

  // 启动打字机效果
  if (typing.value) {
    typing.value.timer = setInterval(() => {
      if (!typing.value) return

      const message = messages.value.find(m => m.id === typing.value!.messageId)
      if (!message) {
        clearInterval(typing.value!.timer)
        typing.value = null
        return
      }

      // 添加下一个字符
      if (typing.value.index < typing.value.text.length) {
        message.content += typing.value.text[typing.value.index]
        typing.value.index++
        scrollToBottom()
      } else {
        // 完成打字
        clearInterval(typing.value.timer)
        typing.value = null
      }
    }, 20) // 调整速度
  }
}

// 切换函数调用详情显示
const toggleFunctionDetails = (message: Message) => {
  if (message.functionCalls && message.functionCalls.length > 0) {
    message.showFunctions = !message.showFunctions
  }
}

// 发送消息到服务器
const sendMessage = () => {
  if (!userInput.value.trim() || loading.value) return

  // 添加用户消息
  const userMessage: Message = {
    id: generateId(),
    role: 'user',
    content: userInput.value
  }
  messages.value.push(userMessage)

  // 添加助手回复占位
  const assistantId = generateId()
  const assistantMessage: Message = {
    id: assistantId,
    role: 'assistant',
    content: '',
    loading: true,
    functionCalls: [],
    showFunctions: true
  }
  messages.value.push(assistantMessage)

  // 清空输入并滚动到底部
  loading.value = true
  error.value = ''
  scrollToBottom()

  // 发送消息到服务器
  socketService.emit('ai:chat-stream', {
    prompt: userInput.value,
    model: selectedModel.value
  })

  userInput.value = ''
}

// 清空聊天记录
const clearChat = () => {
  messages.value = []
}

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
      error.value = data.error || '设置API密钥失败'
    }
  } catch (err) {
    console.error('设置API密钥失败:', err)
    error.value = '设置API密钥失败'
  } finally {
    settingsLoading.value = false
  }
}

onMounted(() => {
  // 连接到WebSocket服务
  socketService.connect()

  // 检查API Key状态
  checkApiKeyStatus()

  // 监听回复开始
  socketService.on('ai:start', () => {
    console.log('AI开始生成回复')
  })

  // 监听错误
  socketService.on('ai:error', (data) => {
    error.value = data.message || '发生错误'
    loading.value = false

    // 移除加载中的消息
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].loading) {
      messages.value.pop()
    }
  })

  // 监听函数调用开始
  socketService.on('ai:function_call_start', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 更新函数调用信息
        lastMessage.functionCalls = data.functionCalls
        lastMessage.showFunctions = true
        scrollToBottom()
      }
    }
  })

  // 监听函数调用结束
  socketService.on('ai:function_call_end', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 更新函数调用结果
        lastMessage.functionCalls = data.functionCalls
        scrollToBottom()
      }
    }
  })

  // 监听流式回复片段
  socketService.on('ai:chunk', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 更新消息内容（不使用打字机效果时）
        if (!typing.value) {
          lastMessage.content += data.content
        } else {
          // 正在使用打字机效果，更新文本但不直接显示
          typing.value.text += data.content
        }

        lastMessage.loading = false
        lastMessage.model = data.model

        // 如果是第一个块，开始打字机效果
        if (!typing.value && lastMessage.content === data.content) {
          startTypingEffect(lastMessage.id, data.content)
        }

        scrollToBottom()
      }
    }
  })

  // 监听回复结束
  socketService.on('ai:end', (data) => {
    loading.value = false

    // 收起函数调用面板（消息完成后）
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        setTimeout(() => {
          lastMessage.showFunctions = false
        }, 1000)
      }
    }

    scrollToBottom()
  })
})

onUnmounted(() => {
  // 清理打字机定时器
  if (typing.value && typing.value.timer) {
    clearInterval(typing.value.timer)
  }

  // 清理Socket监听器
  socketService.off('ai:start')
  socketService.off('ai:error')
  socketService.off('ai:function_call_start')
  socketService.off('ai:function_call_end')
  socketService.off('ai:chunk')
  socketService.off('ai:end')
  socketService.disconnect()
})
</script>

<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <div class="sidebar">
      <!-- 新聊天按钮 -->
      <button class="new-chat-button" @click="clearChat">
        <span>+ 新建聊天</span>
      </button>

      <!-- 底部信息 -->
      <div class="sidebar-footer">
        <div class="model-selector">
          <select v-model="selectedModel">
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
    </div>

    <!-- 主聊天区域 -->
    <div class="main-chat">
      <!-- 消息列表 -->
      <div class="messages-container" ref="chatContainer">
        <div v-if="messages.length === 0" class="welcome-container">
          <div class="welcome-box">
            <h1>UnifiedAI 聊天</h1>
            <p>这是一个基于Gemini的AI聊天应用</p>
          </div>
        </div>

        <div v-else class="message-list">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['message', `message-${message.role}`]"
          >
            <div class="message-avatar">
              <div v-if="message.role === 'user'" class="avatar user-avatar">U</div>
              <div v-else class="avatar assistant-avatar">A</div>
            </div>
            <div class="message-content">
              <!-- 函数调用展示区域 -->
              <div v-if="message.functionCalls && message.functionCalls.length > 0 && message.showFunctions"
                   class="function-calls">
                <div class="function-calls-header" @click="toggleFunctionDetails(message)">
                  <span>AI 正在思考...</span>
                  <span class="toggle-icon">{{ message.showFunctions ? '▼' : '▶' }}</span>
                </div>
                <div v-if="message.showFunctions" class="function-calls-list">
                  <div v-for="(funcCall, index) in message.functionCalls"
                       :key="index"
                       class="function-call-item">
                    <div class="function-name">
                      <span class="function-icon">🔧</span>
                      <span>{{ funcCall.name }}</span>
                    </div>
                    <div class="function-args">
                      <pre>{{ JSON.stringify(funcCall.arguments, null, 2) }}</pre>
                    </div>
                    <div v-if="funcCall.result" class="function-result">
                      <div class="result-label">结果:</div>
                      <pre>{{ JSON.stringify(funcCall.result, null, 2) }}</pre>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 加载指示器 -->
              <p v-if="message.loading" class="loading-indicator">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </p>

              <!-- 消息内容 -->
              <p v-else class="message-text">{{ message.content }}</p>

              <!-- 模型信息 -->
              <div v-if="message.model && !message.loading" class="model-info">
                <span>{{ message.model }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 错误消息 -->
      <div v-if="error" class="error-container">
        <div class="error-message">{{ error }}</div>
      </div>

      <!-- 输入框区域 -->
      <div class="input-container">
        <div class="input-box">
          <textarea
            v-model="userInput"
            placeholder="输入消息..."
            @keydown.enter.prevent="sendMessage"
            :disabled="loading"
            rows="1"
          ></textarea>
          <button
            @click="sendMessage"
            :disabled="!userInput.trim() || loading"
            class="send-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"></path>
            </svg>
          </button>
        </div>
        <div class="input-footer">
          <span>按 Enter 键发送，Shift+Enter 换行</span>
        </div>
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettingsModal" class="settings-modal-overlay">
      <div class="settings-modal">
        <div class="settings-modal-header">
          <h2>API 密钥设置</h2>
          <button class="close-button" @click="closeSettings">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" fill="currentColor"></path>
            </svg>
          </button>
        </div>
        <div class="settings-modal-content">
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
.chat-container {
  display: flex;
  height: 100vh;
  width: 100%;
  background-color: #f7f7f8;
}

.sidebar {
  width: 260px;
  background-color: #202123;
  color: white;
  display: flex;
  flex-direction: column;
  padding: 15px;
}

.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
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

.settings-button {
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
}

.settings-button:hover {
  background-color: #40414f;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.welcome-box {
  text-align: center;
  max-width: 600px;
  padding: 40px;
}

.welcome-box h1 {
  margin-bottom: 10px;
  font-size: 2rem;
}

.message-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.message {
  display: flex;
  padding: 20px;
  margin-bottom: 1px;
}

.message-user {
  background-color: white;
}

.message-assistant {
  background-color: #f7f7f8;
}

.message-avatar {
  margin-right: 15px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.user-avatar {
  background-color: #10a37f;
  color: white;
}

.assistant-avatar {
  background-color: #9b59b6;
  color: white;
}

.message-content {
  flex: 1;
  max-width: 800px;
  line-height: 1.5;
  width: 100%;
}

.message-text {
  white-space: pre-wrap;
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

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

.function-calls {
  margin-bottom: 15px;
  background-color: #f0f0f5;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e5;
}

.function-calls-header {
  background-color: #e0e0e5;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
}

.toggle-icon {
  font-size: 12px;
}

.function-calls-list {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.function-call-item {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px dashed #ccc;
}

.function-call-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.function-name {
  font-weight: bold;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.function-icon {
  margin-right: 8px;
}

.function-args, .function-result {
  background-color: #fff;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  overflow-x: auto;
}

.function-args pre, .function-result pre {
  margin: 0;
  font-size: 12px;
}

.result-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: #10a37f;
}

.model-info {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  text-align: right;
}

.input-container {
  padding: 10px 20px 20px;
  background-color: white;
  border-top: 1px solid #e5e5e5;
}

.input-box {
  display: flex;
  background-color: white;
  border: 1px solid #d9d9e3;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.input-box textarea {
  flex: 1;
  border: none;
  resize: none;
  outline: none;
  font-size: 16px;
  font-family: inherit;
  padding: 6px;
  line-height: 1.4;
}

.send-button {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #10a37f;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-button:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.input-footer {
  text-align: center;
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}

.error-container {
  padding: 15px;
  background-color: rgba(254, 226, 226, 0.8);
  position: absolute;
  bottom: 95px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 6px;
  max-width: 90%;
  z-index: 10;
}

.error-message {
  color: #dc2626;
  font-size: 14px;
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
}

.cancel-button {
  padding: 8px 15px;
  background-color: transparent;
  border: 1px solid #d9d9e3;
  border-radius: 4px;
  cursor: pointer;
}

.save-button {
  padding: 8px 15px;
  background-color: #10a37f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.save-button:disabled, .cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
