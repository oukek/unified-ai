import type { ChatMessage } from '@/stores/chat'

// 函数调用类型定义
export interface FunctionCall {
  id?: string // 添加ID用于展开/折叠状态跟踪
  name: string
  arguments: Record<string, any>
  executionTime?: number
  result?: any
  executing?: boolean // 是否正在执行中
}

// 内容块类型定义
export interface ContentBlock {
  type: 'text' | 'tool' // 文本块或工具调用块
  content?: string // 文本内容
  data?: FunctionCall // 工具调用数据
}

// 扩展 ChatMessage 接口来支持内容块
export interface EnhancedChatMessage extends ChatMessage {
  functionCalls?: FunctionCall[]
  blocks?: ContentBlock[] // 消息内容块
  isLoading?: boolean // 是否正在加载中
} 