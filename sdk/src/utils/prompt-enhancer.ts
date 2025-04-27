import type { AgentFunction, ResponseFormat } from '../types'
import { getFunctionFollowupPrompt, getToolEnhancedPrompt } from './prompt'

/**
 * 提示增强器
 * 用于增强聊天提示，添加函数定义和调用格式说明
 */
export class PromptEnhancer {
  /**
   * 增强聊天提示，添加函数定义和调用格式
   * @param prompt 原始提示
   * @param functions 可用函数列表
   * @returns 增强后的提示
   */
  static enhancePrompt(prompt: string, functions: AgentFunction[]): string {
    if (functions.length === 0) {
      return prompt
    }

    return getToolEnhancedPrompt(prompt, functions)
  }

  /**
   * 创建函数执行后的跟进提示
   * @param originalPrompt 原始用户提示
   * @param previousResponse 上一次模型的响应
   * @param functionResultsSummary 函数执行结果摘要
   * @param responseFormat 响应格式要求
   * @returns 跟进提示
   */
  static createFollowupPrompt(
    originalPrompt: string,
    previousResponse: string,
    functionResultsSummary: string,
    responseFormat?: ResponseFormat,
  ): string {
    return getFunctionFollowupPrompt(
      originalPrompt,
      previousResponse,
      functionResultsSummary,
      responseFormat,
    )
  }
}
