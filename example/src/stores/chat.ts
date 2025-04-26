import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { conversationApi } from '../api/modules/conversation'
import { startAIStreamChat } from '../utils/socket-ai'
import type { ContentBlock, FunctionCall, ChatMessage, Conversation } from '../api/types'

// 扩展API消息类型，添加前端需要的临时属性
interface ExtendedChatMessage extends ChatMessage {
  isLoading?: boolean
}

export type { ContentBlock, FunctionCall, ChatMessage, Conversation }

export const useChatStore = defineStore('chat', () => {
  // 当前会话列表
  const conversations = ref<Conversation[]>([])

  // 当前活跃会话ID
  const activeConversationId = ref('')
  
  // 加载状态
  const isLoading = ref(false)
  
  // 初始化状态
  const isInitialized = ref(false)

  // 消息发送状态
  const isSending = ref(false)

  // 当前活跃会话的消息列表
  const activeMessages = ref<ExtendedChatMessage[]>([])

  // 获取当前活跃会话
  const activeConversation = computed(() => {
    return conversations.value.find(conv => conv.id === activeConversationId.value) || null
  })
  
  // 初始化
  async function initialize() {
    // 防止重复初始化
    if (isInitialized.value) return
    
    isLoading.value = true
    try {
      console.log('开始初始化会话存储...')
      
      // 从后端API加载会话列表
      const response = await conversationApi.getUserConversations()
      const loadedConversations = response.data
      console.log('会话加载成功:', loadedConversations.length)
      conversations.value = loadedConversations.reverse()
      
      // 设置默认活跃会话
      if (conversations.value.length > 0 && !activeConversationId.value) {
        setActiveConversation(conversations.value[0].id)
      }
      
      isInitialized.value = true
    } catch (error) {
      console.error('初始化会话失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 创建新会话
  async function createConversation() {
    try {
      const response = await conversationApi.createConversation('新会话')
      const newConversation = response.data
      
      conversations.value.unshift(newConversation)
      setActiveConversation(newConversation.id)
      
      return newConversation.id
    } catch (error) {
      console.error('创建新会话失败:', error)
      throw error
    }
  }

  // 切换活跃会话
  async function setActiveConversation(id: string) {
    activeConversationId.value = id
    
    // 从后端加载该会话的消息列表
    if (id) {
      try {
        isLoading.value = true
        const response = await conversationApi.getMessages(id)
        activeMessages.value = response.data
      } catch (error) {
        console.error(`加载会话 ${id} 的消息失败:`, error)
        activeMessages.value = []
      } finally {
        isLoading.value = false
      }
    } else {
      activeMessages.value = []
    }
  }

  // 删除会话
  async function deleteConversation(id: string) {
    try {
      await conversationApi.deleteConversation(id)
      
      const index = conversations.value.findIndex(conv => conv.id === id)
      if (index !== -1) {
        conversations.value.splice(index, 1)
        
        // 如果删除的是当前活跃会话，则切换到第一个会话
        if (id === activeConversationId.value) {
          if (conversations.value.length > 0) {
            setActiveConversation(conversations.value[0].id)
          } else {
            activeConversationId.value = ''
            activeMessages.value = []
          }
        }
      }
    } catch (error) {
      console.error('删除会话失败:', error)
      throw error
    }
  }

  // 添加临时消息（加载中）
  function addLoadingMessage(): ExtendedChatMessage | null {
    if (!activeConversationId.value) return null
    
    const message: ExtendedChatMessage = {
      id: Date.now().toString(),
      conversationId: activeConversationId.value,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      blocks: [] // 初始化blocks为空数组，为打字机效果做准备
    }
    
    activeMessages.value.push(message)
    return message
  }

  // 更新会话标题
  async function updateConversationTitle(id: string, title: string) {
    try {
      await conversationApi.updateConversation(id, { title })
      
      const conversation = conversations.value.find(conv => conv.id === id)
      if (conversation) {
        conversation.title = title
      }
    } catch (error) {
      console.error('更新会话标题失败:', error)
      throw error
    }
  }

  // 更新会话系统消息
  async function updateSystemMessage(id: string, systemMessage: string) {
    try {
      await conversationApi.updateConversation(id, { systemMessage })
      
      const conversation = conversations.value.find(conv => conv.id === id)
      if (conversation) {
        conversation.systemMessage = systemMessage
      }
    } catch (error) {
      console.error('更新系统消息失败:', error)
      throw error
    }
  }

  // 使用WebSocket发送消息给AI
  async function sendMessageToAI(content: string) {
    if (!activeConversationId.value) return null
    
    // 检查是否已经初始化
    if (!isInitialized.value) {
      await initialize()
    }
    
    // 设置发送状态
    isSending.value = true
    
    // 先添加用户消息到消息列表
    const userMessage: ExtendedChatMessage = {
      id: `user_${Date.now()}`,
      conversationId: activeConversationId.value,
      content: content,
      role: 'user',
      timestamp: new Date()
    }
    activeMessages.value.push(userMessage)
    
    // 添加一个临时的加载消息
    const loadingMessage = addLoadingMessage()
    if (!loadingMessage) {
      isSending.value = false
      return null
    }
    
    try {
      // 使用WebSocket进行流式聊天
      await startAIStreamChat(activeConversationId.value, content, {
        onStart: () => {
          console.log('开始流式聊天')
        },
        onContent: (newContent) => {
          loadingMessage.isLoading = false
          console.log('onContent', newContent)
          
          // 如果收到的内容为空，则直接返回（主要是为了处理socket-ai.ts中的额外回调）
          if (!newContent) return;
          
          // 实时更新UI
          if (loadingMessage.content === undefined) {
            loadingMessage.content = newContent
          } else {
            loadingMessage.content += newContent
          }
          
          // 添加文本块，确保UI能够实时更新
          if (!loadingMessage.blocks) {
            loadingMessage.blocks = []
          }
          
          // 检查最后一个块是否为文本块
          const lastBlock = loadingMessage.blocks[loadingMessage.blocks.length - 1]
          if (lastBlock && lastBlock.type === 'text') {
            // 更新现有文本块 - 创建新对象以确保响应式更新
            const updatedBlock = {
              ...lastBlock,
              content: (lastBlock.content || '') + newContent
            }
            
            // 使用Vue的响应式API更新数组中的对象，确保触发视图更新
            loadingMessage.blocks.splice(loadingMessage.blocks.length - 1, 1, updatedBlock)
          } else {
            // 添加新文本块
            loadingMessage.blocks.push({
              type: 'text',
              content: newContent
            })
          }
          
          // 使用Vue的响应式更新，确保UI能够感知到变化
          // 创建一个临时对象，触发响应式更新
          const updatedBlocks = [...loadingMessage.blocks]
          loadingMessage.blocks = updatedBlocks
        },
        onFunctionCallStart: (call) => {
          loadingMessage.isLoading = false
          console.log('onFunctionCallStart', call)
          // 添加工具调用块
          if (!loadingMessage.blocks) {
            loadingMessage.blocks = []
          }
          
          loadingMessage.blocks.push({
            type: 'tool',
            data: call
          })
          
          // 更新函数调用数组
          if (!loadingMessage.functionCalls) {
            loadingMessage.functionCalls = []
          }
          loadingMessage.functionCalls.push(call)
        },
        onFunctionCallEnd: (call) => {
          console.log('onFunctionCallEnd', call)
          // 更新工具调用结果
          if (loadingMessage.blocks) {
            const blockIndex = loadingMessage.blocks.findIndex(
              block => block.type === 'tool' && block.data?.id === call.id
            )
            if (blockIndex !== -1) {
              loadingMessage.blocks[blockIndex].data = call
            }
          }
          
          // 更新函数调用数组
          if (loadingMessage.functionCalls) {
            const callIndex = loadingMessage.functionCalls.findIndex(c => c.id === call.id)
            if (callIndex !== -1) {
              loadingMessage.functionCalls[callIndex] = call
            }
          }
        },
        onComplete: (result) => {
          console.log('流式聊天完成', result)
          
          // 加载完成，更新消息
          loadingMessage.isLoading = false
          
          // 如果后端返回了最终消息对象，替换本地消息
          if (result && result.assistantMessage) {
            // 刷新消息列表
            setActiveConversation(activeConversationId.value)
          }
        },
        onError: (error) => {
          console.error('流式聊天错误:', error)
          
          // 显示错误信息
          loadingMessage.content = `发生错误: ${error}`
          loadingMessage.isLoading = false
        }
      })
      
      // WebSocket处理完成后返回当前消息
      return {
        content: loadingMessage.content,
        functionCalls: loadingMessage.functionCalls,
        blocks: loadingMessage.blocks
      }
    }
    catch (error) {
      console.error('AI请求失败:', error)
      
      // 如果有加载消息，更新为错误信息
      if (loadingMessage) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : '发送消息失败，请稍后重试'
        
        // 直接更新消息内容
        loadingMessage.content = `发生错误: ${errorMessage}`
        loadingMessage.isLoading = false
      }
      
      // 重新抛出错误，以便上层组件可以处理
      throw error
    } finally {
      isSending.value = false
    }
  }

  // 在Pinia store创建时自动初始化
  initialize()

  return {
    conversations,
    activeConversationId,
    activeConversation,
    activeMessages,
    isLoading,
    isSending,
    initialize,
    createConversation,
    setActiveConversation,
    deleteConversation,
    updateConversationTitle,
    updateSystemMessage,
    // 统一使用WebSocket方式
    sendMessageToAI
  }
}) 
