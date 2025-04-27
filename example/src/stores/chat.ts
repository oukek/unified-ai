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

  /**
   * 发送消息到AI并处理响应
   * @param content 消息内容
   */
  async function sendMessageToAI(content: string) {
    if (!activeConversationId.value) return null
    
    // 防止重复发送
    if (isSending.value) return null
    isSending.value = true
    
    // 创建一个模拟的用户消息
    let userMessage: ExtendedChatMessage = {
      id: `temp-user-${Date.now()}`,
      conversationId: activeConversationId.value,
      content,
      role: 'user',
      timestamp: new Date(),
      isLoading: false
    }
    
    // 创建一个模拟的AI消息（加载中状态）
    let loadingMessage: ExtendedChatMessage = {
      id: `temp-assistant-${Date.now()}`,
      conversationId: activeConversationId.value,
      content: '',
      role: 'assistant',
      isLoading: true,
      blocks: [],
      timestamp: new Date()
    }
    
    try {
      // 添加消息到显示列表（临时ID版本）
      activeMessages.value.push(userMessage)
      userMessage = activeMessages.value[activeMessages.value.length - 1]
      activeMessages.value.push(loadingMessage)
      loadingMessage = activeMessages.value[activeMessages.value.length - 1]
      
      // 使用WebSocket进行流式聊天，不再传递mcpName参数
      await startAIStreamChat(activeConversationId.value, content, {
        onStart: () => {
          // 已经预先添加了加载状态的消息
          console.log('AI响应开始')
        },
        
        onContent: (chunk) => {
          // 确保isLoading为true以维持打字机效果
          loadingMessage.isLoading = true
          
          // 创建或更新文本块
          const lastBlock = loadingMessage.blocks?.length ? loadingMessage.blocks[loadingMessage.blocks.length - 1] : null
          
          if (lastBlock && lastBlock.type === 'text') {
            lastBlock.content += chunk
          } else {
            if (!loadingMessage.blocks) {
              loadingMessage.blocks = []
            }
            
            loadingMessage.blocks.push({
              type: 'text',
              content: chunk
            })
          }
        },
        
        onFunctionCallStart: (call) => {
          // 确保isLoading为true以维持打字机效果
          loadingMessage.isLoading = true
          console.log('函数调用开始:', call.name)
          
          // 添加函数调用块
          if (!loadingMessage.blocks) {
            loadingMessage.blocks = []
          }
          
          loadingMessage.blocks.push({
            type: 'tool',
            data: call
          })
          
          // 收集函数调用
          if (!loadingMessage.functionCalls) {
            loadingMessage.functionCalls = []
          }
          
          loadingMessage.functionCalls.push(call)
        },
        
        onFunctionCallEnd: (call) => {
          // 确保isLoading为true以维持打字机效果
          loadingMessage.isLoading = true
          console.log('函数调用结束:', call.name, call.result)
          
          // 更新现有的函数调用块
          if (loadingMessage.blocks) {
            const blockIndex = loadingMessage.blocks.findIndex(
              block => block.type === 'tool' && block.data?.id === call.id
            )
            
            if (blockIndex !== -1) {
              loadingMessage.blocks[blockIndex].data = call
            }
          }
          
          // 更新函数调用列表
          if (loadingMessage.functionCalls) {
            const callIndex = loadingMessage.functionCalls.findIndex(
              item => item.id === call.id
            )
            
            if (callIndex !== -1) {
              loadingMessage.functionCalls[callIndex] = call
            }
          }
        },
        
        onComplete: (result) => {
          console.log('AI响应完成', result)
          loadingMessage.isLoading = false
          
          // 使用服务器返回的真实ID替换临时ID
          const userIndex = activeMessages.value.findIndex(m => m.id === userMessage.id)
          const assistantIndex = activeMessages.value.findIndex(m => m.id === loadingMessage.id)
          
          if (userIndex !== -1) {
            activeMessages.value[userIndex] = result.userMessage
          }
          
          if (assistantIndex !== -1) {
            // 确保保留前端生成的blocks信息，而不是使用服务器返回的
            // 只更新必要的字段
            activeMessages.value[assistantIndex] = {
              ...result.assistantMessage,
              blocks: loadingMessage.blocks || [],  // 保留前端生成的blocks
              isLoading: false
            }
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
