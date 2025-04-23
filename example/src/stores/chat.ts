import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAllData, saveData, deleteData, DB } from '../utils/db'
import { useSettingsStore } from './settings'
import { useToolsStore } from './tools'
import { GeminiModel, UnifiedAI, ChatRole } from '@oukek/unified-ai'

export interface FunctionCall {
  id?: string // 用于标识和展开/折叠状态跟踪
  name: string
  arguments: Record<string, any>
  result?: any
  executing?: boolean // 是否正在执行中
}

// 消息内容块类型
export interface ContentBlock {
  type: 'text' | 'tool' // 文本块或工具调用块
  content?: string // 文本内容
  data?: FunctionCall // 工具调用数据
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  functionCalls?: FunctionCall[]
  blocks?: ContentBlock[] // 消息内容块
  isLoading?: boolean // 是否正在加载中
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  systemMessage?: string // 系统消息（可选）
}

// 序列化会话数据（将Date对象转为字符串）
function serializeConversation(conversation: Conversation) {
  return {
    ...conversation,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
    messages: conversation.messages.map(msg => {
      // 深拷贝消息对象，避免修改原始对象
      const serializedMsg = {
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }
      
      // 处理函数调用 - 确保删除所有不可序列化的属性
      if (msg.functionCalls && msg.functionCalls.length > 0) {
        serializedMsg.functionCalls = msg.functionCalls.map(call => {
          const cleanCall = { ...call }
          // 删除可能导致序列化问题的属性
          delete cleanCall.executing
          
          // 安全处理参数和结果
          try {
            cleanCall.arguments = JSON.parse(JSON.stringify(cleanCall.arguments || {}))
            if (cleanCall.result !== undefined) {
              cleanCall.result = JSON.parse(JSON.stringify(cleanCall.result))
            }
          } catch (err) {
            console.warn('函数调用参数或结果无法序列化，已替换为空对象', err)
            cleanCall.arguments = {}
            cleanCall.result = undefined
          }
          
          return cleanCall
        })
      }
      
      // 处理内容块 - 确保删除所有不可序列化的属性
      if (msg.blocks && msg.blocks.length > 0) {
        serializedMsg.blocks = msg.blocks.map(block => {
          const cleanBlock = { ...block }
          
          // 如果是工具调用块，安全处理data属性
          if (block.type === 'tool' && block.data) {
            const cleanData = { ...block.data }
            delete cleanData.executing
            
            // 安全处理参数和结果
            try {
              cleanData.arguments = JSON.parse(JSON.stringify(cleanData.arguments || {}))
              if (cleanData.result !== undefined) {
                cleanData.result = JSON.parse(JSON.stringify(cleanData.result))
              }
            } catch (err) {
              console.warn('内容块数据无法序列化，已替换为空对象', err)
              cleanData.arguments = {}
              cleanData.result = undefined
            }
            
            cleanBlock.data = cleanData
          }
          
          return cleanBlock
        })
      }
      
      // 移除不可序列化的属性
      delete serializedMsg.isLoading
      
      return serializedMsg
    })
  }
}

// 反序列化会话数据（将字符串转为Date对象）
function deserializeConversation(data: any): Conversation {
  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    messages: data.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }))
  }
}

// 保存单个会话
async function saveConversation(conversation: Conversation): Promise<void> {
  try {
    const serialized = serializeConversation(conversation)
    await saveData(DB.STORES.CONVERSATIONS, serialized)
    console.log(`保存会话 ${conversation.id} 成功`)
  } catch (error) {
    console.error('保存会话失败:', error)
    // 尝试记录更详细的错误信息
    if (error instanceof Error) {
      console.error('错误详情:', error.message)
      if (error.stack) {
        console.error('错误堆栈:', error.stack)
      }
    }
    throw error
  }
}

// 加载所有会话
async function loadConversations(): Promise<Conversation[]> {
  try {
    const data = await getAllData(DB.STORES.CONVERSATIONS)
    console.log('加载会话成功，会话数量:', data.length)
    
    // 反序列化
    return data.map(item => deserializeConversation(item))
  } catch (error) {
    console.error('加载会话失败:', error)
    return []
  }
}

// 删除会话
async function deleteConversationFromDB(id: string): Promise<void> {
  try {
    await deleteData(DB.STORES.CONVERSATIONS, id)
    console.log(`删除会话 ${id} 成功`)
  } catch (error) {
    console.error(`删除会话 ${id} 失败:`, error)
    throw error
  }
}

// 创建UnifiedAI实例
function createAI(apiKey: string) {
  try {
    const geminiModel = new GeminiModel({
      apiKey,
    })
    return new UnifiedAI(geminiModel)
  } catch (error) {
    console.error('创建AI实例失败:', error)
    throw error
  }
}

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

  // 获取当前活跃会话
  const activeConversation = computed(() => {
    return conversations.value.find(conv => conv.id === activeConversationId.value) || null
  })
  
  // 引入工具存储
  const toolsStore = useToolsStore()
  
  // 初始化
  async function initialize() {
    // 防止重复初始化
    if (isInitialized.value) return
    
    isLoading.value = true
    try {
      console.log('开始初始化会话存储...')
      
      const loadedConversations = await loadConversations()
      console.log('会话加载成功:', loadedConversations.length)
      conversations.value = loadedConversations.reverse()
      
      // 设置默认活跃会话
      if (conversations.value.length > 0 && !activeConversationId.value) {
        activeConversationId.value = conversations.value[0].id
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
    const newId = Date.now().toString()
    const newConversation: Conversation = {
      id: newId,
      title: '新会话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      systemMessage: '' // 默认为空字符串
    }
    conversations.value.unshift(newConversation)
    activeConversationId.value = newId
    
    // 保存到数据库
    try {
      await saveConversation(newConversation)
    } catch (error) {
      console.error('保存新会话失败:', error)
    }
    
    return newId
  }

  // 切换活跃会话
  function setActiveConversation(id: string) {
    activeConversationId.value = id
  }

  // 删除会话
  async function deleteConversation(id: string) {
    const index = conversations.value.findIndex(conv => conv.id === id)
    if (index !== -1) {
      conversations.value.splice(index, 1)
      
      // 如果删除的是当前活跃会话，则切换到第一个会话
      if (id === activeConversationId.value) {
        activeConversationId.value = conversations.value.length > 0 ? conversations.value[0].id : ''
      }
      
      // 从数据库中删除
      try {
        await deleteConversationFromDB(id)
      } catch (error) {
        console.error('从数据库删除会话失败:', error)
      }
    }
  }

  // 添加用户消息
  async function addUserMessage(content: string) {
    if (!activeConversation.value) return

    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    }

    activeConversation.value.messages.push(message)
    activeConversation.value.updatedAt = new Date()
    
    // 保存到数据库
    try {
      await saveConversation(activeConversation.value)
    } catch (error) {
      console.error('保存用户消息失败:', error)
    }
    
    return message
  }

  // 添加助手消息，支持工具调用和内容块
  async function addAssistantMessage(content: string, functionCalls?: FunctionCall[], blocks?: ContentBlock[]) {
    if (!activeConversation.value) return

    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      functionCalls,
      blocks
    }

    activeConversation.value.messages.push(message)
    activeConversation.value.updatedAt = new Date()
    
    // 保存到数据库
    try {
      await saveConversation(activeConversation.value)
    } catch (error) {
      console.error('保存助手消息失败:', error)
    }
    
    return message
  }

  // 添加临时消息（加载中）
  function addLoadingMessage() {
    if (!activeConversation.value) return null
    
    const message: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      blocks: [] // 初始化blocks为空数组，为打字机效果做准备
    }
    
    activeConversation.value.messages.push(message)
    return message
  }

  // 更新消息内容
  async function updateMessage(id: string, content: string, functionCalls?: FunctionCall[], blocks?: ContentBlock[]) {
    if (!activeConversation.value) return

    const message = activeConversation.value.messages.find(msg => msg.id === id)
    if (message) {
      message.content = content
      
      // 更新函数调用和内容块
      if (functionCalls !== undefined) {
        message.functionCalls = functionCalls
      }
      
      if (blocks !== undefined) {
        message.blocks = blocks
      }
      
      // 移除加载状态
      if (message.isLoading) {
        message.isLoading = false
      }
      
      activeConversation.value.updatedAt = new Date()
      
      // 保存到数据库
      try {
        await saveConversation(activeConversation.value)
      } catch (error) {
        console.error('保存更新的消息失败:', error)
      }
    }
  }

  // 更新会话标题
  async function updateConversationTitle(id: string, title: string) {
    const conversation = conversations.value.find(conv => conv.id === id)
    if (conversation) {
      conversation.title = title
      conversation.updatedAt = new Date()
      
      // 保存到数据库
      try {
        await saveConversation(conversation)
      } catch (error) {
        console.error('保存更新的会话标题失败:', error)
      }
    }
  }

  // 更新会话系统消息
  async function updateSystemMessage(id: string, systemMessage: string) {
    const conversation = conversations.value.find(conv => conv.id === id)
    if (conversation) {
      conversation.systemMessage = systemMessage
      conversation.updatedAt = new Date()
      
      // 保存到数据库
      try {
        await saveConversation(conversation)
      } catch (error) {
        console.error('保存更新的系统消息失败:', error)
      }
    }
  }

  // 使用流式响应发送消息给AI
  async function sendMessageToAIStream(content: string) {
    if (!activeConversation.value) return null
    
    const settingsStore = useSettingsStore()
    const apiKey = settingsStore.geminiApiKey
    
    // 检查是否设置了API密钥
    if (!apiKey) {
      throw new Error('请先在设置中配置Gemini API密钥')
    }
    
    // 添加用户消息
    await addUserMessage(content)
    
    // 设置发送状态
    isSending.value = true
    
    // 添加一个临时的加载消息
    const loadingMessage = addLoadingMessage()
    if (!loadingMessage) {
      isSending.value = false
      return null
    }
    
    try {
      // 创建AI实例
      const ai = createAI(apiKey)
      
      // 添加工具到AI实例
      ai.addFunctions(toolsStore.getEnabledTools())
      
      // 准备历史对话
      const history = activeConversation.value.messages
        .filter(msg => !msg.isLoading) // 过滤掉正在加载的消息
        .slice(0, -1) // 不包括刚添加的用户消息（因为它将作为prompt发送）
        .map(msg => ({
          role: msg.role === 'user' ? ChatRole.USER : ChatRole.ASSISTANT, 
          content: msg.content
        }))
      
      // 设置系统消息（如果有）
      const systemMessage = activeConversation.value.systemMessage
      
      // 初始化完整响应内容
      let fullContent = ''
      
      // 使用内容块数组保持内容和函数调用的顺序
      const contentBlocks: ContentBlock[] = []
      
      // 创建一个文本块的工具函数
      const addTextBlock = (text: string) => {
        if (!text) return
        
        // 如果最后一个块是文本块，则追加内容
        const lastBlock = contentBlocks[contentBlocks.length - 1]
        if (lastBlock && lastBlock.type === 'text') {
          lastBlock.content += text
        } else {
          // 否则创建新的文本块
          contentBlocks.push({
            type: 'text',
            content: text
          })
        }
      }
      
      // 发送流式请求到AI
      const stream = ai.unifiedChatStream(content, {
        history,
        systemMessage: systemMessage || undefined
      })
      
      // 创建一个直接更新UI但不写入数据库的函数
      const updateUI = () => {
        // 只更新内存中的消息对象，不写入数据库
        const message = activeConversation.value?.messages.find(msg => msg.id === loadingMessage.id)
        if (message && message.isLoading) { // 只对isLoading=true的消息应用打字机效果
          // 只更新content，不重新创建blocks数组
          message.content = fullContent
          
          // 如果message.blocks不存在，则初始化它
          if (!message.blocks) {
            message.blocks = []
          }
          
          // 直接更新现有blocks或添加新blocks，而不是替换整个数组
          // 确保blocks数组长度与contentBlocks相同
          while (message.blocks.length < contentBlocks.length) {
            message.blocks.push({
              type: 'text',
              content: ''
            })
          }
          
          // 更新每个block的内容，而不是替换整个数组
          for (let i = 0; i < contentBlocks.length; i++) {
            const sourceBlock = contentBlocks[i]
            const targetBlock = message.blocks[i]
            
            // 更新类型
            targetBlock.type = sourceBlock.type
            
            // 更新内容或数据
            if (sourceBlock.type === 'text') {
              targetBlock.content = sourceBlock.content
            } else if (sourceBlock.type === 'tool' && sourceBlock.data) {
              targetBlock.data = sourceBlock.data // 工具数据通常是不可变的，所以直接引用即可
            }
          }
          
          // 如果有多余的blocks，移除它们
          if (message.blocks.length > contentBlocks.length) {
            message.blocks.length = contentBlocks.length
          }
        }
      }
      
      // 处理流式响应
      for await (const chunk of stream) {
        // 处理函数调用（可能在任何一个块中出现）
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          // 处理每个函数调用
          for (const call of chunk.functionCalls) {
            // 转换为我们自己的FunctionCall类型
            const functionCall: FunctionCall = {
              name: call.name,
              arguments: call.arguments,
              result: call.result,
              id: Date.now() + '-' + Math.random().toString(36).substring(2, 9) // 生成唯一ID
            }
            
            // 避免重复添加相同的函数调用
            const isDuplicate = contentBlocks.some(block => 
              block.type === 'tool' && 
              block.data?.name === functionCall.name && 
              JSON.stringify(block.data?.arguments) === JSON.stringify(functionCall.arguments)
            )
            
            if (!isDuplicate) {
              // 添加工具调用块
              contentBlocks.push({
                type: 'tool',
                data: functionCall
              })
              
              // 更新UI，不写入数据库
              updateUI()
            }
          }
        }
        
        // 累积内容
        if (typeof chunk.content === 'string' && chunk.content) {
          fullContent += chunk.content
          
          // 添加文本内容块
          addTextBlock(chunk.content)
          
          // 更新UI，不写入数据库
          updateUI()
        }
      }
      
      // 流结束后，将最终消息保存到数据库
      // 移除加载状态
      const message = activeConversation.value?.messages.find(msg => msg.id === loadingMessage.id)
      if (message) {
        message.isLoading = false
      }
      
      // 保存到数据库 - 只在最后保存一次
      if (activeConversation.value) {
        await saveConversation(activeConversation.value)
      }
      
      // 如果是第一条消息，更新会话标题
      if (activeConversation.value.messages.length <= 2) {
        try {
          const titleAI = createAI(apiKey)
          const titleResponse = await titleAI.unifiedChat(`基于以下对话生成一个简短的标题（不超过15个字符）：\n用户: ${content}\n助手: ${fullContent.substring(0, 100)}`)
          
          const title = titleResponse.content as string
          await updateConversationTitle(activeConversation.value.id, title)
        } catch (error) {
          console.error('生成标题失败:', error)
          // 失败时使用默认标题
          if (activeConversation.value.title === '新会话') {
            const shortContent = content.length > 10 ? `${content.substring(0, 10)}...` : content
            await updateConversationTitle(activeConversation.value.id, shortContent)
          }
        }
      }
      
      // 从内容块中提取函数调用
      const functionCalls = contentBlocks
        .filter(block => block.type === 'tool' && block.data)
        .map(block => block.data as FunctionCall);
      
      return {
        content: fullContent,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
        blocks: contentBlocks
      }
    } catch (error) {
      console.error('AI流式请求失败:', error)
      
      // 如果有加载消息，更新为错误信息
      if (loadingMessage) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : '发送消息失败，请稍后重试'
        
        // 直接更新消息内容
        const message = activeConversation.value?.messages.find(msg => msg.id === loadingMessage.id)
        if (message) {
          message.content = `发生错误: ${errorMessage}`
          message.isLoading = false
        }
        
        // 保存到数据库
        if (activeConversation.value) {
          await saveConversation(activeConversation.value)
        }
      }
      
      // 重新抛出错误，以便上层组件可以处理
      if (error instanceof Error) {
        throw error
      } else {
        throw new Error('发送消息失败，请稍后重试')
      }
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
    isLoading,
    isSending,
    initialize,
    createConversation,
    setActiveConversation,
    deleteConversation,
    addUserMessage,
    addAssistantMessage,
    updateMessage,
    updateConversationTitle,
    updateSystemMessage,
    sendMessageToAIStream
  }
}) 
