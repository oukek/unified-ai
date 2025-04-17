import { api, socketService } from '@/utils'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAppStore } from './appStore'

// Message and history interfaces
export interface FunctionCall {
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

export interface MessageSegment {
  type: 'text' | 'function'
  content: string
  functionCall?: FunctionCall
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  loading?: boolean
  functionCalls?: FunctionCall[]
  showFunctions?: boolean
  model?: string
  segments?: MessageSegment[]
  timestamp?: number
  serverId?: string
  chatId?: string
  error?: boolean
  errorMessage?: string
}

export interface ChatHistorySummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messageCount: number
  preview: string
}

export interface ChatHistoryDetail {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  systemMessage?: string
  messages: Message[]
}

export const useChatStore = defineStore('chat', () => {
  // Get the app store for error handling
  const appStore = useAppStore()

  // State
  const messages = ref<Message[]>([])
  const systemMessage = ref('')
  const currentHistoryId = ref<string | null>(null)
  const historyList = ref<ChatHistorySummary[]>([])
  const historyLoading = ref(false)
  const selectedModel = ref('gemini-2.0-flash')
  const loading = ref(false)
  // 是否启用打字机效果
  const enableTypingEffect = ref(false)

  // 打字机效果控制
  const typing = ref<{ messageId: string, text: string, index: number, timer: any } | null>(null)
  // 文本缓冲区 - 用于收集完整段落
  const textBuffer = ref('')
  // 是否正在收集段落标志
  const isCollectingParagraph = ref(false)
  // 段落收集定时器
  const paragraphTimer = ref<number | null>(null)

  // Helper function to generate ID
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  // Split message into segments based on function calls
  const splitMessageIntoSegments = (message: Message): MessageSegment[] => {
    if (!message.content || !message.functionCalls || message.functionCalls.length === 0) {
      // If there are no function calls, create a single text segment
      return [
        { type: 'text', content: message.content || '' },
      ]
    }

    // Sort function calls by position
    const sortedCalls = [...message.functionCalls].sort((a, b) => {
      return (a.position || 0) - (b.position || 0)
    })

    const segments: MessageSegment[] = []
    let lastEndIndex = 0

    // Loop through sorted function calls
    sortedCalls.forEach((call) => {
      const position = call.position || 0

      // If there's text before the function call, add a text segment
      if (position > lastEndIndex) {
        segments.push({
          type: 'text',
          content: message.content.substring(lastEndIndex, position),
        })
      }

      // Add function call segment
      segments.push({
        type: 'function',
        content: '',
        functionCall: call,
      })

      // Update last processed position to function call position
      lastEndIndex = position
    })

    // If there's text after the last function call, add a final text segment
    if (lastEndIndex < message.content.length) {
      segments.push({
        type: 'text',
        content: message.content.substring(lastEndIndex),
      })
    }

    return segments
  }

  // 重置缓冲区
  const resetBuffer = () => {
    textBuffer.value = ''
    isCollectingParagraph.value = false
    if (paragraphTimer.value) {
      clearTimeout(paragraphTimer.value)
      paragraphTimer.value = null
    }
  }

  // 清理打字机定时器
  const clearTypingTimer = () => {
    if (typing.value && typing.value.timer) {
      clearInterval(typing.value.timer)
      typing.value.timer = null
    }
  }

  // Clear chat
  const clearChat = () => {
    messages.value = []
    currentHistoryId.value = null
    // Don't clear system message, allow it to be used in new conversations
  }

  // Start new chat
  const startNewChat = () => {
    clearChat()
    // Clear system message when starting a new chat
    systemMessage.value = ''
  }

  // Get history list
  const getHistoryList = async () => {
    try {
      historyLoading.value = true
      const response = await api.get('/api/ai/history')
      if (response.data.success) {
        historyList.value = response.data.list
      }
    }
    catch (err) {
      console.error('获取历史记录列表失败:', err)
      appStore.showError('获取历史记录列表失败')
    }
    finally {
      historyLoading.value = false
    }
  }

  // Load history detail
  const loadHistoryDetail = async (historyId: string) => {
    try {
      historyLoading.value = true
      const response = await api.get(`/api/ai/history/${historyId}`)

      if (response.data.success) {
        const history = response.data.detail as ChatHistoryDetail

        // Update current session ID and system message
        currentHistoryId.value = history.id
        systemMessage.value = history.systemMessage || ''
        selectedModel.value = history.model || 'gemini-2.0-flash'

        // Load history messages
        messages.value = history.messages.map(msg => ({
          ...msg,
          // Ensure assistant messages have correct paragraph separation
          segments: msg.role === 'assistant'
            ? splitMessageIntoSegments(msg)
            : undefined,
        }))
      }
      else {
        appStore.showError('加载历史记录失败')
      }
    }
    catch (err) {
      console.error('加载历史记录详情失败:', err)
      appStore.showError('加载历史记录详情失败')
    }
    finally {
      historyLoading.value = false
    }
  }

  // Create new history
  const createNewHistory = async (initialMessage?: string) => {
    if (loading.value)
      return null

    try {
      const title = `${initialMessage?.substring(0, 30)}...` || '新会话'

      const response = await api.post('/api/ai/history', {
        title,
        model: selectedModel.value,
        systemMessage: systemMessage.value,
        initialMessage,
      })

      if (response.data.success) {
        currentHistoryId.value = response.data.historyId

        // No longer create message here since it will be created in sendMessage
        // This avoids duplicate messages with different IDs

        await getHistoryList()
        return response.data.historyId
      }
      else {
        appStore.showError('创建聊天历史失败')
        return null
      }
    }
    catch (err) {
      console.error('创建聊天历史失败:', err)
      appStore.showError('创建聊天历史失败')
      return null
    }
  }

  // Delete history
  const deleteHistory = async (historyId: string) => {
    try {
      const response = await api.delete(`/api/ai/history/${historyId}`)

      if (response.data.success) {
        // Update history list
        historyList.value = historyList.value.filter(h => h.id !== historyId)

        // If the current session is deleted, clear the current session
        if (currentHistoryId.value === historyId) {
          clearChat()
        }

        return true
      }
      else {
        appStore.showError('删除历史记录失败')
        return false
      }
    }
    catch (err) {
      console.error('删除历史记录失败:', err)
      appStore.showError('删除历史记录失败')
      return false
    }
  }

  // Clear all history
  const clearAllHistory = async () => {
    try {
      const response = await api.delete('/api/ai/history')

      if (response.data.success) {
        historyList.value = []
        clearChat()
        return true
      }
      else {
        appStore.showError('清空历史记录失败')
        return false
      }
    }
    catch (err) {
      console.error('清空历史记录失败:', err)
      appStore.showError('清空历史记录失败')
      return false
    }
  }

  // Save system message
  const saveSystemMessage = async () => {
    // If there's no current history ID, create a new history
    if (!currentHistoryId.value) {
      currentHistoryId.value = await createNewHistory()
    }

    // If there's a current history ID, update the system message
    if (currentHistoryId.value) {
      try {
        const response = await api.patch(`/api/ai/history/${currentHistoryId.value}/system`, {
          systemMessage: systemMessage.value,
        })

        if (!response.data.success) {
          appStore.showError('保存系统消息失败')
        }

        return response.data.success
      }
      catch (err) {
        console.error('保存系统消息失败:', err)
        appStore.showError('保存系统消息失败')
        return false
      }
    }

    return false
  }

  // 打字机效果函数
  const startTypingEffect = (messageId: string, text: string) => {
    // 清除之前的定时器
    clearTypingTimer()

    // 找到消息并设置初始文本为空
    const message = messages.value.find(m => m.id === messageId)
    if (message) {
      // 仅当是新消息时才重置内容，否则保留现有内容并追加
      if (!message.content || message.content === '') {
        message.content = ''
      }
    }

    // 设置打字机状态
    typing.value = {
      messageId,
      text,
      index: 0,
      timer: null,
    }

    // 启动打字机效果
    if (typing.value) {
      typing.value.timer = setInterval(() => {
        if (!typing.value)
          return

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
            message.functionCalls.forEach((fc) => {
              if (fc.position !== undefined && fc.contentBefore) {
                if (message.content.length > fc.contentBefore.length) {
                  fc.contentAfter = message.content.substring(fc.contentBefore.length)
                }
              }
            })
          }

          // 更新分段内容
          if (message.segments) {
            message.segments = splitMessageIntoSegments(message)
          }
          else {
            message.segments = splitMessageIntoSegments(message)
          }
        }
        else {
          // 完成打字
          clearInterval(typing.value.timer)
          typing.value = null
        }
      }, 10) // 调整速度
    }
  }

  // 设置 Socket 事件处理
  const setupSocketEvents = (scrollToBottomCallback?: () => void) => {
    // 监听回复开始
    socketService.on('ai:start', () => {
      console.log('AI开始生成回复')
    })

    // 监听流式回复片段
    socketService.on('ai:chunk', (data) => {
      console.log('AI流式回复片段:', data)

      // 从返回数据中提取chatId和messageId
      const { chatId, messageId } = data

      // 如果服务器返回了chatId，更新当前会话ID
      if (chatId && !currentHistoryId.value) {
        currentHistoryId.value = chatId
      }

      if (messages.value.length > 0) {
        const lastMessage = messages.value[messages.value.length - 1]

        // 如果服务器返回了messageId，使用服务器的messageId更新本地消息ID
        if (messageId && lastMessage.role === 'assistant') {
          // 只在第一次接收时更新ID，避免重复更新
          if (!lastMessage.serverId) {
            lastMessage.serverId = messageId
          }
        }

        if (lastMessage.role === 'assistant') {
          // 获取处理后的文本
          const content = data.content

          // 避免处理空内容
          if (!content || content.trim() === '') {
            return
          }

          // 禁用打字机效果，直接更新内容
          if (!enableTypingEffect.value) {
            // 直接更新内容，不使用打字机效果
            lastMessage.content += content

            // 如果有函数调用，则更新函数调用后的内容
            if (lastMessage.functionCalls && lastMessage.functionCalls.length > 0) {
              lastMessage.functionCalls.forEach((fc) => {
                if (fc.position !== undefined && fc.contentBefore) {
                  if (lastMessage.content.length > fc.contentBefore.length) {
                    fc.contentAfter = lastMessage.content.substring(fc.contentBefore.length)
                  }
                }
              })
            }

            // 如果不是最后一个块，更新分段内容
            if (!data.isLast) {
              lastMessage.segments = splitMessageIntoSegments(lastMessage)
            }
          }
          else {
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
                }
                else {
                  startTypingEffect(lastMessage.id, textBuffer.value)
                }

                resetBuffer()

                lastMessage.loading = false
                lastMessage.model = data.model

                // 执行滚动回调
                if (scrollToBottomCallback) {
                  scrollToBottomCallback()
                }
              }, 200)
            }
            else if (!isCollectingParagraph.value) {
              if (!typing.value) {
                startTypingEffect(lastMessage.id, textBuffer.value)
                resetBuffer()
              }
              else {
                typing.value.text += textBuffer.value
                resetBuffer()
              }
            }
          }

          lastMessage.loading = false
          lastMessage.model = data.model
          lastMessage.timestamp = Date.now()

          // 保存服务端返回的chatId
          if (chatId) {
            lastMessage.chatId = chatId
          }

          // 执行滚动回调
          if (scrollToBottomCallback) {
            scrollToBottomCallback()
          }
        }
      }
    })

    // 监听回复结束
    socketService.on('ai:end', (data) => {
      console.log('AI回复结束:', data)
      loading.value = false

      // 从返回数据中提取chatId和messageId
      const { chatId, messageId } = data

      // 如果服务器返回了chatId，更新当前会话ID
      if (chatId && !currentHistoryId.value) {
        currentHistoryId.value = chatId
      }

      // 处理最后一条消息
      if (messages.value.length > 0) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage.role === 'assistant') {
          // 如果服务器返回了messageId，使用服务器的messageId更新本地消息ID
          if (messageId && !lastMessage.serverId) {
            lastMessage.serverId = messageId
          }

          // 保存服务端返回的chatId
          if (chatId) {
            lastMessage.chatId = chatId
          }

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
          }
          else if (!enableTypingEffect.value) {
            // 在非打字机模式下，确保最后更新一次分段内容
            if (lastMessage.segments) {
              lastMessage.segments = splitMessageIntoSegments(lastMessage)
            }
            else {
              lastMessage.segments = splitMessageIntoSegments(lastMessage)
            }
            // 清空缓冲区，防止潜在的重复
            resetBuffer()
          }

          // 执行滚动回调
          if (scrollToBottomCallback) {
            scrollToBottomCallback()
          }
        }
      }
    })

    // 监听错误
    socketService.on('ai:error', (data) => {
      console.error('AI错误:', data)
      loading.value = false

      // 从返回数据中提取chatId和messageId
      const { chatId, messageId, message } = data

      // 如果服务器返回了chatId，更新当前会话ID
      if (chatId && !currentHistoryId.value) {
        currentHistoryId.value = chatId
      }

      // 在消息中标记错误
      if (messages.value.length > 0) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage.role === 'assistant') {
          // 如果服务器返回了messageId，使用服务器的messageId更新本地消息ID
          if (messageId && !lastMessage.serverId) {
            lastMessage.serverId = messageId
          }

          // 保存服务端返回的chatId
          if (chatId) {
            lastMessage.chatId = chatId
          }

          // 标记为错误状态
          lastMessage.error = true
          lastMessage.errorMessage = message
          lastMessage.loading = false
        }
      }

      // 显示错误信息
      if (message) {
        appStore.showError(message)
      }
    })

    // 监听历史记录创建成功事件
    socketService.on('ai:history-created', (data) => {
      if (data && data.historyId) {
        currentHistoryId.value = data.historyId
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
            }
            else {
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
                completed: false,
              }
            })

            // 如果已有函数调用，则合并；否则直接赋值
            if (lastMessage.functionCalls && lastMessage.functionCalls.length > 0) {
              lastMessage.functionCalls = [...lastMessage.functionCalls, ...newFunctionCalls]
            }
            else {
              lastMessage.functionCalls = newFunctionCalls
            }
          }

          // 更新分段内容
          if (lastMessage.segments) {
            lastMessage.segments = splitMessageIntoSegments(lastMessage)
          }
          else {
            lastMessage.segments = splitMessageIntoSegments(lastMessage)
          }
        }
      }
    })
  }

  // 初始化 Socket 连接和事件监听
  const initSocketConnection = (scrollToBottomCallback?: () => void) => {
    // 连接到WebSocket服务
    socketService.connect()

    // 设置基本事件监听
    setupSocketEvents(scrollToBottomCallback)
  }

  // 清理所有 Socket 事件监听
  const cleanupSocketEvents = () => {
    socketService.off('ai:start')
    socketService.off('ai:chunk')
    socketService.off('ai:end')
    socketService.off('ai:history-created')
    socketService.off('ai:function_call_start')
    socketService.off('ai:history-list')
    socketService.off('ai:history-detail')
    socketService.off('ai:history-deleted')
    socketService.disconnect()

    // 清理打字机定时器
    clearTypingTimer()

    // 清理其他定时器
    resetBuffer()
  }

  // 发送消息到服务器
  const sendMessage = async (userInputText: string, scrollToBottomCallback?: () => void) => {
    if (!userInputText.trim() || loading.value)
      return

    // 创建用户消息对象
    const userMessageId = generateId()
    const userMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: userInputText,
      timestamp: Date.now(),
    }

    // 确保有一个有效的历史记录ID
    if (!currentHistoryId.value) {
      // 创建新的历史记录
      currentHistoryId.value = await createNewHistory(userInputText)
      if (!currentHistoryId.value) {
        return // 创建历史记录失败
      }
    }

    // 将当前历史记录ID添加到用户消息中
    userMessage.chatId = currentHistoryId.value

    // 添加用户消息到消息列表
    messages.value.push(userMessage)

    // 添加助手回复占位
    const assistantId = generateId()
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      loading: true,
      functionCalls: [],
      showFunctions: false,
      chatId: currentHistoryId.value,
    }
    messages.value.push(assistantMessage)

    // 设置加载状态
    loading.value = true

    // 执行滚动回调，如果提供了的话
    if (scrollToBottomCallback) {
      scrollToBottomCallback()
    }

    // 发送消息到服务器（包含历史记录ID和系统消息）
    socketService.emit('ai:chat-stream', {
      prompt: userInputText,
      model: selectedModel.value,
      systemMessage: systemMessage.value,
      historyId: currentHistoryId.value,
      messageId: userMessageId, // 传递消息ID，确保服务器和客户端同步
      clientAssistantId: assistantId, // 传递客户端生成的助手消息ID
    })
  }

  return {
    // 状态
    messages,
    systemMessage,
    currentHistoryId,
    historyList,
    historyLoading,
    selectedModel,
    loading,
    enableTypingEffect,
    typing,
    textBuffer,
    isCollectingParagraph,

    // 数据处理和效果函数
    startTypingEffect,
    resetBuffer,
    clearTypingTimer,

    // Socket 和通信函数
    sendMessage,
    initSocketConnection,
    setupSocketEvents,
    cleanupSocketEvents,

    // 现有的操作
    getHistoryList,
    loadHistoryDetail,
    createNewHistory,
    deleteHistory,
    clearAllHistory,
    saveSystemMessage,
    clearChat,
    startNewChat,
    splitMessageIntoSegments,
    generateId,
  }
})
