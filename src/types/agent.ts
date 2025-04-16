import type { z } from 'zod'
import type { ChatOptions, ChatResponse, ResponseFormat } from '.'

/**
 * Agent 功能类型
 */
export interface AgentFunction {
  /** 函数名称 */
  name: string
  /** 函数描述 */
  description?: string
  /** 函数参数模式 */
  parameters: z.ZodObject<any> | Record<string, any>
  /** 函数执行器 */
  executor?: (params: Record<string, any>) => Promise<any>
}

export interface AgentFunctionSchema {
  name: string
  description?: string
  parameters: Record<string, any>
  executor?: (params: Record<string, any>) => Promise<any>
}

/**
 * Agent事件类型
 */
export enum AgentEventType {
  /** AI响应开始 */
  RESPONSE_START = 'response_start',
  /** AI响应结束 */
  RESPONSE_END = 'response_end',
  /** AI响应片段 */
  RESPONSE_CHUNK = 'response_chunk',
  /** 函数调用开始 */
  FUNCTION_CALL_START = 'function_call_start',
  /** 函数调用结束 */
  FUNCTION_CALL_END = 'function_call_end',
  /** 递归调用开始 */
  RECURSION_START = 'recursion_start',
  /** 递归调用结束 */
  RECURSION_END = 'recursion_end',
  /** 发生错误 */
  ERROR = 'error',
}

/**
 * Agent事件数据
 */
export interface AgentEvent {
  /** 事件类型 */
  type: AgentEventType
  /** 事件数据 */
  data: any
  /** 时间戳 */
  timestamp: number
}

/**
 * Agent事件回调函数类型
 */
export type AgentEventCallback = (event: AgentEvent) => void | Promise<void>

/**
 * 聊天会话扩展选项
 */
export interface ChatSessionOptions extends ChatOptions {
  /** 事件回调函数 */
  eventCallback?: AgentEventCallback
}

/**
 * UnifiedAI 配置选项
 */
export interface UnifiedAIOptions {
  /** 代理功能 */
  functions?: AgentFunction[]
  /** 最大函数调用递归次数（用于支持链式调用），默认为25 */
  maxRecursionDepth?: number
  /** 其他配置选项 */
  [key: string]: any
}

/**
 * 函数调用结构
 */
export interface FunctionCall {
  /** 函数名称 */
  name: string
  /** 函数参数 */
  arguments: Record<string, any>
  /** 函数执行结果 */
  result?: any
}

/**
 * 增强的聊天响应
 */
export interface EnhancedChatResponse<T extends ResponseFormat | undefined = undefined> extends ChatResponse<T> {
  /** 函数调用详情 */
  functionCalls?: FunctionCall[]
}

/**
 * Agent回调函数类型
 */
export type AgentCallback = (state: string, data: any) => void | Promise<void>
