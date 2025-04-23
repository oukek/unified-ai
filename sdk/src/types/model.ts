/**
 * 大模型通用类型定义
 */

/**
 * 聊天消息的角色
 */
export enum ChatRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  /** 消息角色 */
  role: ChatRole
  /** 消息内容 */
  content: string
}

/**
 * 响应格式类型
 */
export enum ResponseFormat {
  /** 文本格式 */
  TEXT = 'text',
  /** JSON格式 */
  JSON = 'json',
}

/**
 * 根据响应格式确定内容类型
 */
export type ContentType<T extends ResponseFormat | undefined> =
  T extends ResponseFormat.JSON
    ? Record<string, any>
    : string

/**
 * 聊天请求选项
 */
export interface ChatOptions {
  /** 聊天历史记录 */
  history?: ChatMessage[]
  /** 模型名称 */
  model?: string
  /** 温度参数 (0-1)，控制输出的随机性 */
  temperature?: number
  /** 最大输出长度 */
  maxTokens?: number
  /** 响应格式 */
  responseFormat?: ResponseFormat
  /** 系统消息 */
  systemMessage?: string
  /** 自定义模型参数 */
  [key: string]: any
}

/**
 * 聊天响应
 */
export interface ChatResponse<T extends ResponseFormat | undefined = undefined> {
  /**
   * 响应内容
   * 当 responseFormat 为 JSON 时，这是一个解析后的 JSON 对象
   * 当 responseFormat 为 TEXT 或未指定时，这是一个字符串
   */
  content: ContentType<T>
  /** 标识响应内容是否为JSON对象 */
  isJsonResponse: T extends ResponseFormat.JSON ? true : boolean
  /** 使用的模型 */
  model: string
  /** 消耗的token数量 */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  /** 额外信息，可以存储原始用户提问等元数据 */
  additionalInfo?: {
    userPrompt?: string
    [key: string]: any
  }
}

/**
 * 流式聊天响应片段
 */
export interface ChatStreamChunk<T extends ResponseFormat | undefined = undefined> {
  /**
   * 响应片段内容
   * 最后一个片段中：
   * - 当 responseFormat 为 JSON 时，这是一个解析后的 JSON 对象
   * - 当 responseFormat 为 TEXT 或未指定时，这是一个字符串
   * 非最后一个片段中，通常为字符串
   */
  content: boolean extends IsLast<this> ? string : ContentType<T>
  /** 标识响应内容是否为JSON对象 */
  isJsonResponse: T extends ResponseFormat.JSON ? boolean : boolean
  /** 是否是最后一个片段 */
  isLast?: boolean
  /** 使用的模型 */
  model?: string
  /** 此片段的token数量 */
  chunkTokens?: number
  /** 函数调用信息，仅在存在函数调用时有值 */
  functionCalls?: Record<string, any>[]
}

/**
 * 用于确定是否为最后一个片段的辅助类型
 */
type IsLast<T> = T extends { isLast: infer L } ? L : false

/**
 * 获取匹配选项的响应类型
 */
export type ResponseTypeForOptions<T extends ChatOptions | undefined> =
  T extends { responseFormat: ResponseFormat.JSON }
    ? ChatResponse<ResponseFormat.JSON>
    : ChatResponse<ResponseFormat.TEXT>

/**
 * 获取匹配选项的流式响应片段类型
 */
export type StreamChunkTypeForOptions<T extends ChatOptions | undefined> =
  T extends { responseFormat: ResponseFormat.JSON }
    ? ChatStreamChunk<ResponseFormat.JSON>
    : ChatStreamChunk<ResponseFormat.TEXT>
