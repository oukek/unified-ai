import type { BaseModel } from '../base'
import type { AgentFunctionSchema, ChatMessage, ChatOptions } from '../types'
import { ChatRole } from '../types'
import { getToolEnhancedPrompt } from './prompt'

/**
 * 模型助手类
 * 提供处理不同模型特性的工具方法
 */
export class ModelHelpers {
  /**
   * 转换统一格式的工具到模型特定的格式
   * @param tools 统一格式的工具
   * @param model 模型实例
   * @returns 模型特定格式的工具或null（如果不支持）
   */
  static convertToolsForModel(tools: AgentFunctionSchema[], model: BaseModel, options?: ChatOptions): any {
    if (!tools || tools.length === 0) {
      return undefined
    }

    if (!model.supportsTools(options?.model)) {
      return undefined
    }

    // 使用模型自己的转换方法
    return model.convertToolsFormat(tools)
  }

  /**
   * 融合 content 和 tools，创建适合不支持 tools 的模型的增强提示
   * @param content 原始提示内容
   * @param tools 工具定义
   * @returns 增强后的提示
   */
  static enhanceContentWithTools(content: string, tools: AgentFunctionSchema[]): string {
    if (!tools || tools.length === 0) {
      return content
    }

    // 使用prompt模块中的函数
    return getToolEnhancedPrompt(content, tools)
  }

  /**
   * 处理 system 消息，根据模型能力进行适配
   * @param messages 聊天消息数组
   * @param model 模型实例
   * @returns 处理后的消息数组
   */
  static processSystemMessages(messages: ChatMessage[], model: BaseModel, options?: ChatOptions): ChatMessage[] {
    if (!messages || messages.length === 0) {
      return messages
    }

    // 如果模型支持系统消息，则直接返回
    if (model.supportsSystemMessages(options?.model)) {
      return messages
    }

    // 如果不支持系统消息，将系统消息转换为用户消息
    const processedMessages: ChatMessage[] = []
    let systemContent = ''

    // 收集所有系统消息
    for (const message of messages) {
      if (message.role === ChatRole.SYSTEM) {
        if (systemContent)
          systemContent += '\n\n'
        systemContent += message.content
      }
      else {
        processedMessages.push(message)
      }
    }

    // 如果有系统消息，在开始添加为用户消息
    if (systemContent) {
      processedMessages.unshift({
        role: ChatRole.USER,
        content: `System Instructions:\n${systemContent}\n\nPlease follow above instructions for all your responses.`,
      })

      // 如果第一个非系统消息是助手消息，添加一个空的用户消息确保交替
      if (processedMessages.length > 0 && processedMessages[0].role === ChatRole.ASSISTANT) {
        processedMessages.unshift({
          role: ChatRole.USER,
          content: 'Please continue according to the above system instructions.',
        })
      }
    }

    return processedMessages
  }

  /**
   * 准备聊天选项，根据模型能力增强选项
   * @param options 原始选项
   * @param model 模型实例
   * @param functions 函数列表
   * @returns 增强后的选项
   */
  static prepareOptionsForModel<T extends ChatOptions | undefined = undefined>(
    options: T | undefined,
    model: BaseModel,
    functions: AgentFunctionSchema[] = [],
  ): T {
    if (!options) {
      return options as T
    }

    // 创建选项的副本，避免修改原始对象
    const enhancedOptions = { ...options } as Record<string, any>

    // 处理工具
    enhancedOptions.tools = this.convertToolsForModel(functions, model, options)

    // 处理历史消息中的系统消息
    enhancedOptions.history = this.processSystemMessages(enhancedOptions.history, model, options)

    return enhancedOptions as T
  }
}
