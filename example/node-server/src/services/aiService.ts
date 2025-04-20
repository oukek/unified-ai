import type { ChatMessage, ChatResponse, ChatStreamChunk, ResponseFormat } from '@oukek/unified-ai'
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'
import { searchByGoogle } from '../tools/searchByGoogle'
import { searchWebByUrl } from '../tools/searchWebByUrl'
import { configService } from './configService'
import { historyService } from './historyService'

/**
 * 回调状态类型
 * - response_start: 开始生成回答
 * - function_call_start: 开始调用函数
 * - function_call_end: 函数调用结束
 * - response_chunk: 流式响应的部分内容
 * - response_end: 响应完成
 * - error: 发生错误
 */
export type CallbackState = string

/**
 * 聊天选项接口
 */
export interface ChatOptions {
  // 模型名称
  model?: string
  // 系统消息
  systemMessage?: string
  // 历史消息
  history?: ChatMessage[]
  // 历史记录ID (如果指定，将自动保存对话)
  historyId: string
  // 消息ID
  messageId: string
  // 助手ID
  assistantId: string
  // 回调函数
  callback?: (state: CallbackState, data: any) => void
}

/**
 * AI服务类，封装与AI模型的交互
 */
class AiService {
  private ai: UnifiedAI | null = null

  /**
   * 初始化AI服务
   */
  initialize(): boolean {
    try {
      const apiKey = configService.getGeminiApiKey()
      if (!apiKey) {
        console.warn('未配置Gemini API密钥，AI服务初始化失败')
        return false
      }

      const geminiModel = new GeminiModel({
        apiKey,
        model: 'gemini-2.0-flash', // 默认使用flash模型
      })

      this.ai = new UnifiedAI(geminiModel, {
        maxRecursionDepth: 10,
        functions: [
          searchWebByUrl,
          searchByGoogle,
        ],
      })

      console.log('AI服务已初始化')
      return true
    }
    catch (error) {
      console.error('初始化AI服务时出错:', error)
      return false
    }
  }

  /**
   * 获取可用的模型列表
   */
  getAvailableModels(): { id: string, name: string, description: string }[] {
    // 目前只支持Gemini模型，后续可以扩展
    return [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        description: 'Google的快速推理AI模型',
      },
    ]
  }

  /**
   * 创建新的聊天历史记录
   */
  async createChatHistory(data: {
    title: string
    model: string
    systemMessage?: string
  }): Promise<string> {
    return historyService.createHistory(data)
  }

  /**
   * 进行聊天
   * @param prompt 聊天提示词
   * @param options 选项
   * @returns 聊天响应，如果初始化失败则返回null
   */
  async chat(prompt: string, options: ChatOptions): Promise<ChatResponse<ResponseFormat.TEXT> | null> {
    if (!this.ai) {
      if (!this.initialize()) {
        return null
      }
    }

    try {
      // 保存用户消息
      await historyService.addMessageToHistory(options.historyId, {
        role: 'user',
        content: prompt,
        timestamp: Date.now(),
        id: options.messageId,
      })
      const response = await this.ai!.unifiedChat(prompt, {
        model: options?.model,
        systemMessage: options?.systemMessage,
        history: options?.history,
      }, options?.callback) as ChatResponse<ResponseFormat.TEXT> & {
        functionCalls?: any[]
        functionResults?: any[]
      }

      // 保存AI响应
      if (response) {
        await historyService.addMessageToHistory(options.historyId, {
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          functionCalls: response.functionCalls,
          functionResults: response.functionResults,
          id: options.assistantId,
        })
      }

      return response
    }
    catch (error) {
      console.error('AI聊天时出错:', error)
      options?.callback?.('error', { error })
      return null
    }
  }

  /**
   * 进行流式聊天 (返回异步生成器)
   * @param prompt 聊天提示词
   * @param options 选项
   * @returns 聊天响应的异步生成器，如果初始化失败则返回null
   */
  async* chatStream(prompt: string, options?: ChatOptions): AsyncGenerator<ChatStreamChunk<ResponseFormat.TEXT> | null> {
    if (!this.ai) {
      if (!this.initialize()) {
        options?.callback?.('error', { error: new Error('AI服务未初始化') })
        yield null
        return
      }
    }

    let fullContent = ''
    let functionCalls: any[] = []
    const startTime = Date.now()

    try {
      // 如果指定了历史记录ID，先保存用户消息
      if (options?.historyId) {
        await historyService.addMessageToHistory(options.historyId, {
          role: 'user',
          content: prompt,
          timestamp: startTime,
          id: options.messageId,
        })
      }

      const generator = this.ai!.unifiedChatStream(prompt, {
        model: options?.model,
        systemMessage: options?.systemMessage,
        history: options?.history,
      }, options?.callback)

      for await (const chunk of generator) {
        // 收集完整内容和函数调用
        if (chunk.content) {
          fullContent += chunk.content
        }

        if ('functionCalls' in chunk && Array.isArray(chunk.functionCalls)) {
          functionCalls = chunk.functionCalls
        }

        yield chunk as ChatStreamChunk<ResponseFormat.TEXT>

        // 如果是最后一个块且指定了历史记录ID，保存AI响应
        if (chunk.isLast && options?.historyId) {
          await historyService.addMessageToHistory(options.historyId, {
            role: 'assistant',
            content: fullContent,
            timestamp: Date.now(),
            functionCalls,
            functionResults: 'functionResults' in chunk && Array.isArray(chunk.functionResults) ? chunk.functionResults : undefined,
            id: options.assistantId,
          })
        }
      }
    }
    catch (error) {
      console.error('AI流式聊天时出错:', error)
      options?.callback?.('error', { error })
      yield null
    }
  }
}

// 导出单例
export const aiService = new AiService()
