import type { ChatStreamChunk, ResponseFormat } from '@oukek/unified-ai'
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'
import { configService } from './configService'

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
        maxRecursionDepth: 5,
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
   * 进行聊天
   * @param prompt 聊天提示词
   * @param options 选项
   * @param options.model 模型名称
   * @param options.callback 回调函数，用于获取各个阶段的状态和数据
   *   - response_start: 开始生成回答
   *   - function_call_start: 开始调用函数
   *   - function_call_end: 函数调用结束
   *   - response_end: 响应完成
   *   - error: 发生错误
   * @returns 聊天响应，如果初始化失败则返回null
   */
  async chat(prompt: string, options?: {
    model?: string
    callback?: (state: CallbackState, data: any) => void
  }): Promise<any | null> {
    if (!this.ai) {
      if (!this.initialize()) {
        return null
      }
    }

    try {
      const response = await this.ai!.unifiedChat(prompt, {
        model: options?.model,
      }, options?.callback)

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
   * @param options.model 模型名称
   * @param options.callback 回调函数，用于获取各个阶段的状态和数据
   *   - response_start: 开始生成回答
   *   - function_call_start: 开始调用函数
   *   - function_call_end: 函数调用结束
   *   - response_chunk: 流式响应的部分内容
   *   - response_end: 响应完成
   *   - error: 发生错误
   * @returns 聊天响应的异步生成器，如果初始化失败则返回null
   */
  async* chatStream(prompt: string, options?: {
    model?: string
    callback?: (state: CallbackState, data: any) => void
  }): AsyncGenerator<ChatStreamChunk<ResponseFormat.TEXT> | null> {
    if (!this.ai) {
      if (!this.initialize()) {
        options?.callback?.('error', { error: new Error('AI服务未初始化') })
        yield null
        return
      }
    }

    try {
      const generator = this.ai!.unifiedChatStream(prompt, {
        model: options?.model,
      }, options?.callback)

      for await (const chunk of generator) {
        yield chunk as ChatStreamChunk<ResponseFormat.TEXT>
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
