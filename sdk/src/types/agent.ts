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
 * 响应开始事件数据
 */
export interface ResponseStartEventData {
  /** 提示内容 */
  prompt: string
  /** 请求选项 */
  options?: ChatOptions
}

/**
 * 响应结束事件数据
 */
export interface ResponseEndEventData {
  /** 响应结果 */
  response: ChatResponse<any>
}

/**
 * 响应块事件数据
 */
export interface ResponseChunkEventData {
  /** 响应块 */
  chunk: {
    content: string | any
    isJsonResponse: boolean
    isLast: boolean
    model?: string
  }
}

/**
 * 函数调用开始事件数据
 */
export interface FunctionCallStartEventData {
  /** 函数调用列表 */
  functionCalls: FunctionCall[]
}

/**
 * 函数调用结束事件数据
 */
export interface FunctionCallEndEventData {
  /** 函数调用列表（包含结果） */
  functionCalls: FunctionCall[]
}

/**
 * 递归开始事件数据
 */
export interface RecursionStartEventData {
  /** 初始内容 */
  initialContent: string | Record<string, any>
  /** 函数调用列表 */
  functionCalls: FunctionCall[]
  /** 初始响应 */
  initialResponse?: ChatResponse<any>
  /** 深度 */
  depth: number
}

/**
 * 递归结束事件数据
 */
export interface RecursionEndEventData {
  /** 最终内容 */
  finalContent: any
  /** 函数调用列表 */
  functionCalls: FunctionCall[]
  /** 响应 */
  response: ChatResponse<any>
  /** 深度 */
  depth: number
  /** 完成执行的函数调用 */
  completedFunctionCalls: FunctionCall[]
}

/**
 * 错误事件数据
 */
export interface ErrorEventData {
  /** 提示内容 */
  prompt?: string
  /** 请求选项 */
  options?: ChatOptions
  /** 错误信息 */
  error: string
  /** 出错的函数调用 */
  functionCall?: FunctionCall
}

/**
 * Agent事件类型到数据类型的映射
 */
export interface AgentEventDataMap {
  [AgentEventType.RESPONSE_START]: ResponseStartEventData
  [AgentEventType.RESPONSE_END]: ResponseEndEventData
  [AgentEventType.RESPONSE_CHUNK]: ResponseChunkEventData
  [AgentEventType.FUNCTION_CALL_START]: FunctionCallStartEventData
  [AgentEventType.FUNCTION_CALL_END]: FunctionCallEndEventData
  [AgentEventType.RECURSION_START]: RecursionStartEventData
  [AgentEventType.RECURSION_END]: RecursionEndEventData
  [AgentEventType.ERROR]: ErrorEventData
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
  /** 唯一标识符 */
  id: string
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
export type AgentCallback = <T extends keyof AgentEventDataMap>(
  state: T,
  data: AgentEventDataMap[T]
) => void | Promise<void>
