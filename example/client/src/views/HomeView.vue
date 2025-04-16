<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { socketService, api } from '@/utils'
import { marked } from 'marked'

interface FunctionCall {
  name: string
  arguments: any
  result?: any
  position?: number
  contentBefore?: string
  contentAfter?: string
  id?: string
  showDetails?: boolean
  completed?: boolean
}

interface MessageSegment {
  type: 'text' | 'function'
  content: string
  functionCall?: FunctionCall
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  loading?: boolean
  functionCalls?: FunctionCall[]
  showFunctions?: boolean
  model?: string
  segments?: MessageSegment[]
}

// 聊天消息
const messages = ref<Message[]>([])
// 用户输入
const userInput = ref('')
// 加载状态
const loading = ref(false)
// 错误消息
const error = ref('')
// 错误消息定时器
const errorTimer = ref<number | null>(null)
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

// 处理多余的换行符，将连续的换行符替换为单个换行符
const normalizeNewlines = (text: string): string => {
  // 使用更强的正则替换多余换行
  // return text.replace(/\n{2,}/g, '\n');
  return text;
}

// 安全地使用marked渲染markdown
const renderMarkdown = (text: string) => {
  try {
    // 处理多余的换行符
    const normalizedText = normalizeNewlines(text);
    return marked.parse(normalizedText);
  } catch (e) {
    console.error('Markdown渲染失败:', e);
    return text;
  }
}

// 文本缓冲区 - 用于收集完整段落
const textBuffer = ref('')
// 是否正在收集段落标志
const isCollectingParagraph = ref(false)
// 段落收集定时器
const paragraphTimer = ref<number | null>(null)

// 重置缓冲区
const resetBuffer = () => {
  textBuffer.value = ''
  isCollectingParagraph.value = false
  if (paragraphTimer.value) {
    clearTimeout(paragraphTimer.value)
    paragraphTimer.value = null
  }
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
    // 仅当是新消息时才重置内容，否则保留现有内容并追加
    if (!message.content || message.content === '') {
      message.content = ''
    }
  }

  // 处理多余的换行符
  const normalizedText = normalizeNewlines(text)

  // 设置打字机状态
  typing.value = {
    messageId,
    text: normalizedText,
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

        // 更新函数调用后的内容
        if (message.functionCalls && message.functionCalls.length > 0) {
          message.functionCalls.forEach(fc => {
            if (fc.position !== undefined && fc.contentBefore) {
              if (message.content.length > fc.contentBefore.length) {
                fc.contentAfter = message.content.substring(fc.contentBefore.length)
              }
            }
          })
        }

        // 更新分段内容
        updateMessageSegments(message)

        scrollToBottom()
      } else {
        // 完成打字
        clearInterval(typing.value.timer)
        typing.value = null
      }
    }, 20) // 调整速度
  }
}

// 切换特定函数调用的显示/隐藏状态
const toggleFunction = (functionId: string) => {
  if (messages.value) {
    messages.value.forEach(message => {
      if (message.functionCalls) {
        message.functionCalls.forEach(fc => {
          if (fc.id === functionId) {
            fc.showDetails = !fc.showDetails
          }
        })
      }
    })
  }
}

// 清除错误消息定时器
const clearErrorTimer = () => {
  if (errorTimer.value) {
    clearTimeout(errorTimer.value)
    errorTimer.value = null
  }
}

// 显示错误消息
const showError = (message: string) => {
  error.value = message

  // 清除之前的定时器
  clearErrorTimer()

  // 设置新的定时器，5秒后自动清除错误消息
  errorTimer.value = window.setTimeout(() => {
    error.value = ''
    errorTimer.value = null
  }, 5000)
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
    showFunctions: false
  }
  messages.value.push(assistantMessage)

  // 清空输入并滚动到底部
  loading.value = true
  error.value = ''
  clearErrorTimer() // 清除可能存在的错误定时器
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
      showError(data.error || '设置API密钥失败')
    }
  } catch (err) {
    console.error('设置API密钥失败:', err)
    showError('设置API密钥失败')
  } finally {
    settingsLoading.value = false
  }
}

// 输入框自动调整大小
const resizeTextarea = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement

  // 重置高度以便重新计算
  textarea.style.height = 'auto'

  // 计算新高度，但设置最大行数限制
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight)
  const maxHeight = lineHeight * 4 // 最多显示4行

  // 计算实际高度并应用限制
  const newHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${newHeight}px`
}

// 是否启用打字机效果
const enableTypingEffect = ref(false)

onMounted(() => {
  // 连接到WebSocket服务
  socketService.connect()

  // 检查API Key状态
  checkApiKeyStatus()

  // 监听回复开始
  socketService.on('ai:start', () => {
    console.log('AI开始生成回复')
  })

  // 监听流式回复片段
  socketService.on('ai:chunk', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 获取处理后的文本
        const content = data.content

        // 避免处理空内容
        if (!content || content.trim() === '') {
          return;
        }

        // 禁用打字机效果，直接更新内容
        if (!enableTypingEffect.value) {
          // 直接更新内容，不使用打字机效果
          lastMessage.content += content

          // 如果有函数调用，则更新函数调用后的内容
          if (lastMessage.functionCalls && lastMessage.functionCalls.length > 0) {
            lastMessage.functionCalls.forEach(fc => {
              if (fc.position !== undefined && fc.contentBefore) {
                if (lastMessage.content.length > fc.contentBefore.length) {
                  fc.contentAfter = lastMessage.content.substring(fc.contentBefore.length)
                }
              }
            })
          }

          // 如果不是最后一个块，更新分段内容
          if (!data.isLast) {
            updateMessageSegments(lastMessage)
          }
        } else {
          // 将文本加入缓冲区，只有在启用打字机效果时才需要
          textBuffer.value += content

          // 使用缓冲区和打字机效果的原有逻辑
          const isEndOfSentence = content.match(/[.!?。！？]\s*$/) !== null

          if (isEndOfSentence) {
            isCollectingParagraph.value = true

            if (paragraphTimer.value) {
              clearTimeout(paragraphTimer.value)
            }

            paragraphTimer.value = window.setTimeout(() => {
              if (typing.value && typing.value.messageId === lastMessage.id) {
                typing.value.text += textBuffer.value
              } else {
                startTypingEffect(lastMessage.id, textBuffer.value)
              }

              resetBuffer()

              lastMessage.loading = false
              lastMessage.model = data.model
              scrollToBottom()
            }, 200)
          } else if (!isCollectingParagraph.value) {
            if (!typing.value) {
              startTypingEffect(lastMessage.id, textBuffer.value)
              resetBuffer()
            } else {
              typing.value.text += textBuffer.value
              resetBuffer()
            }
          }
        }

        lastMessage.loading = false
        lastMessage.model = data.model
        scrollToBottom()
      }
    }
  })

  // 监听函数调用开始
  socketService.on('ai:function_call_start', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 如果正在收集段落，先结束当前段落
        if (isCollectingParagraph.value && textBuffer.value) {
          // 将缓冲区内容添加到消息内容
          if (typing.value && typing.value.messageId === lastMessage.id) {
            typing.value.text += textBuffer.value
          } else {
            lastMessage.content += textBuffer.value
          }
          resetBuffer()
        }

        // 计算函数调用的位置，默认为当前内容长度（即追加到末尾）
        const currentPosition = lastMessage.content ? lastMessage.content.length : 0

        // 处理每个新的函数调用
        if (data.functionCalls && data.functionCalls.length > 0) {
          // 为每个新函数调用生成唯一ID和位置信息
          const newFunctionCalls = data.functionCalls.map((fc: FunctionCall) => {
            return {
              ...fc,
              id: generateId(),
              position: currentPosition,
              contentBefore: lastMessage.content || '',
              contentAfter: '',
              showDetails: false,
              completed: false
            }
          })

          // 如果已有函数调用，则合并；否则直接赋值
          if (lastMessage.functionCalls && lastMessage.functionCalls.length > 0) {
            lastMessage.functionCalls = [...lastMessage.functionCalls, ...newFunctionCalls]
          } else {
            lastMessage.functionCalls = newFunctionCalls
          }
        }

        // 更新分段内容
        updateMessageSegments(lastMessage)
        scrollToBottom()
      }
    }
  })

  // 监听函数调用结束
  socketService.on('ai:function_call_end', (data) => {
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant' && data.functionCalls && data.functionCalls.length > 0) {
        // 尝试匹配每个返回的函数调用结果与现有的函数调用
        data.functionCalls.forEach((resultFC: FunctionCall) => {
          // 查找对应的函数调用
          if (lastMessage.functionCalls) {
            // 先查找名称和参数都匹配的未完成函数调用
            const matchedFC = lastMessage.functionCalls.find(fc =>
              fc.name === resultFC.name &&
              !fc.completed &&
              JSON.stringify(fc.arguments) === JSON.stringify(resultFC.arguments)
            )

            if (matchedFC) {
              // 更新结果和完成状态
              matchedFC.result = resultFC.result
              matchedFC.completed = true
            } else {
              // 如果找不到精确匹配，则添加为新的函数调用（通常不应该发生）
              const newFC = {
                ...resultFC,
                id: generateId(),
                position: lastMessage.content.length,
                showDetails: false,
                completed: true
              }
              lastMessage.functionCalls.push(newFC)
            }
          }
        })

        // 更新分段内容
        updateMessageSegments(lastMessage)
        scrollToBottom()
      }
    }
  })

  // 监听回复结束
  socketService.on('ai:end', (data) => {
    console.log('AI回复结束:', data);
    loading.value = false

    // 处理最后一条消息
    if (messages.value.length > 0) {
      const lastMessage = messages.value[messages.value.length - 1]
      if (lastMessage.role === 'assistant') {
        // 设置消息的模型信息
        if (data && data.model && !lastMessage.model) {
          lastMessage.model = data.model
        }

        // 处理缓冲区最后的内容 - 仅在启用打字机效果时才处理缓冲区
        if (enableTypingEffect.value && textBuffer.value && textBuffer.value.trim()) {
          if (typing.value) {
            typing.value.text += textBuffer.value
          }
          resetBuffer() // 重置缓冲区
        } else if (!enableTypingEffect.value) {
          // 在非打字机模式下，确保最后更新一次分段内容
          updateMessageSegments(lastMessage)
          // 清空缓冲区，防止潜在的重复
          resetBuffer()
        }
      }
    }

    scrollToBottom()
  })

  // 监听错误
  socketService.on('ai:error', (data) => {
    showError(data.message || '发生错误')
    loading.value = false

    // 移除加载中的消息
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].loading) {
      messages.value.pop()
    }
  })
})

// 将消息按函数调用位置分段
const updateMessageSegments = (message: Message) => {
  if (!message.content || !message.functionCalls || message.functionCalls.length === 0) {
    // 如果没有函数调用，则创建单个文本段
    message.segments = [
      { type: 'text', content: message.content || '' }
    ]
    return
  }

  // 按位置排序函数调用
  const sortedCalls = [...message.functionCalls].sort((a, b) => {
    return (a.position || 0) - (b.position || 0)
  })

  const segments: MessageSegment[] = []
  let lastEndIndex = 0

  // 遍历排序后的函数调用
  sortedCalls.forEach(call => {
    const position = call.position || 0

    // 如果函数调用前有文本，添加文本段
    if (position > lastEndIndex) {
      segments.push({
        type: 'text',
        content: message.content.substring(lastEndIndex, position)
      })
    }

    // 添加函数调用段
    segments.push({
      type: 'function',
      content: '',
      functionCall: call
    })

    // 更新最后处理位置为函数调用位置
    lastEndIndex = position
  })

  // 如果最后还有文本，添加最后的文本段
  if (lastEndIndex < message.content.length) {
    segments.push({
      type: 'text',
      content: message.content.substring(lastEndIndex)
    })
  }

  message.segments = segments
}

onUnmounted(() => {
  // 清理打字机定时器
  if (typing.value && typing.value.timer) {
    clearInterval(typing.value.timer)
  }

  // 清理错误定时器
  clearErrorTimer()

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
            <p>这是一个基于 UnifiedAI 的AI聊天应用</p>
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
              <!-- 加载指示器 -->
              <p v-if="message.loading" class="loading-indicator">
                <span class="dot"></span>
                <span class="dot"></span>
                <span class="dot"></span>
              </p>

              <!-- 用户消息直接显示内容，不使用分段 -->
              <div v-else-if="message.role === 'user'" class="user-message-text">
                {{ message.content }}
              </div>

              <!-- 助手回复使用分段显示 -->
              <div v-else class="segmented-content">
                <template v-for="(segment, index) in message.segments" :key="index">
                  <!-- 文本段 -->
                  <div v-if="segment.type === 'text'"
                       class="text-segment"
                       v-html="renderMarkdown(segment.content)"></div>

                  <!-- 函数调用段 -->
                  <div v-else-if="segment.type === 'function' && segment.functionCall"
                       class="function-segment">
                    <div class="function-calls-container">
                      <div class="function-calls-toggle"
                           @click="segment.functionCall.showDetails = !segment.functionCall.showDetails">
                        <span class="function-badge">
                          <span class="function-icon">🔧</span>
                          {{ segment.functionCall.name }}
                        </span>
                        <span class="toggle-icon">{{ segment.functionCall.showDetails ? '▼' : '▶' }}</span>
                      </div>

                      <div v-if="segment.functionCall.showDetails" class="function-calls">
                        <div class="function-calls-list">
                          <div class="function-call-item">
                            <div class="function-name">
                              <span>工具调用: {{ segment.functionCall.name }}</span>
                            </div>
                            <div class="function-args">
                              <div class="args-label">参数:</div>
                              <pre>{{ JSON.stringify(segment.functionCall.arguments, null, 2) }}</pre>
                            </div>
                            <div v-if="segment.functionCall.result" class="function-result">
                              <div class="result-label">结果:</div>
                              <div class="result-content"
                                   v-html="renderMarkdown(typeof segment.functionCall.result === 'string' ?
                                                         segment.functionCall.result :
                                                         JSON.stringify(segment.functionCall.result, null, 2))"></div>
                            </div>
                            <div v-else-if="segment.functionCall.completed === false" class="function-waiting">
                              <div class="waiting-label">等待结果...</div>
                              <div class="waiting-indicator">
                                <span class="small-dot"></span>
                                <span class="small-dot"></span>
                                <span class="small-dot"></span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>

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
        <div class="input-options">
          <label class="option-label">
            <input type="checkbox" v-model="enableTypingEffect">
            <span>打字机效果</span>
          </label>
        </div>
        <div class="input-box">
          <textarea
            v-model="userInput"
            placeholder="输入消息..."
            @keydown.enter="(event) => {
              if (event.shiftKey) {
                // Shift+Enter 时不阻止默认行为，允许换行
                return;
              } else {
                // 仅 Enter 键时阻止默认行为并发送消息
                event.preventDefault();
                sendMessage();
              }
            }"
            @input="resizeTextarea"
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
  line-height: 1.5;
  width: 100%;
}

.segmented-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.text-segment {
  margin-bottom: 0.5em;
}

.text-segment:last-child {
  margin-bottom: 0;
}

.function-segment {
  margin: 0;
  width: 100%;
}

.function-calls-container {
  margin: 4px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e5;
  background-color: #f8f8fa;
}

.function-calls-toggle {
  background-color: #f0f0f5;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  color: #555;
  border-bottom: 1px solid #e0e0e5;
}

.function-calls {
  background-color: #f7f7f9;
  border-radius: 0 0 8px 8px;
}

.function-calls-list {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 0.85rem;
}

.function-call-item {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px dashed #ddd;
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
  font-size: 0.9rem;
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
  font-size: 0.8rem;
}

.function-args pre, .function-result pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
}

.result-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: #10a37f;
  font-size: 0.85rem;
}

.toggle-icon {
  font-size: 12px;
  color: #888;
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

.input-options {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.option-label {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  user-select: none;
}

.option-label input {
  margin-right: 4px;
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
  overflow-y: auto;
  min-height: 38px;
  max-height: calc(1.4em * 4 + 12px);
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

/* 文本段和函数调用段的样式 */
.text-segment {
  margin-bottom: 10px;
  font-size: 1rem;
  line-height: 1.5;
}

/* 支持Markdown渲染的基本样式 */
.text-segment :deep(h1),
.text-segment :deep(h2),
.text-segment :deep(h3) {
  margin-top: 1em;
  margin-bottom: 0.5em;
}

.text-segment :deep(p) {
  margin-bottom: 0.75em;
}

.text-segment :deep(ul),
.text-segment :deep(ol) {
  padding-left: 1.5em;
  margin-bottom: 1em;
}

.text-segment :deep(li) {
  margin-bottom: 0.25em;
}

.text-segment :deep(pre) {
  background-color: #f5f5f5;
  padding: 0.5em;
  border-radius: 4px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.text-segment :deep(code) {
  background-color: #f5f5f5;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  white-space: pre-wrap;
}

.text-segment :deep(blockquote) {
  border-left: 3px solid #ddd;
  padding-left: 1em;
  color: #666;
  margin-left: 0;
  margin-right: 0;
}

.text-segment :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 1em;
}

.text-segment :deep(th),
.text-segment :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5em;
}

.text-segment :deep(a) {
  color: #10a37f;
  text-decoration: none;
}

.text-segment :deep(a:hover) {
  text-decoration: underline;
}

/* 函数调用结果的Markdown渲染 */
.result-content {
  white-space: break-spaces;
  word-break: break-word;
  background-color: #fff;
  border-radius: 4px;
  padding: 8px;
  overflow-x: auto;
  font-size: 0.8rem;
}

.result-content :deep(pre) {
  margin: 0;
  white-space: pre-wrap;
}

.function-badge {
  display: flex;
  align-items: center;
  font-size: 0.9rem;
  color: #444;
  background-color: #f0f0f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.function-icon {
  margin-right: 6px;
}

.function-calls-toggle {
  background-color: #f7f7f9;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  border-bottom: 1px solid #e0e0e5;
}

.function-name {
  font-weight: bold;
  margin-bottom: 12px;
  color: #333;
}

.args-label, .result-label, .waiting-label {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 0.85rem;
}

.args-label {
  color: #666;
}

.result-label {
  color: #10a37f;
}

.waiting-label {
  color: #f59f00;
}

.function-waiting {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 8px;
}

.waiting-indicator {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.small-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #f59f00;
  animation: pulse 1.5s infinite ease-in-out;
}

.small-dot:nth-child(2) {
  animation-delay: 0.5s;
}

.small-dot:nth-child(3) {
  animation-delay: 1s;
}

.user-message-text {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 10px;
  font-size: 1rem;
  line-height: 1.5;
}
</style>
