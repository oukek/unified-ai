import type { AgentFunction, ChatOptions, ResponseTypeForOptions, StreamChunkTypeForOptions } from '../types'

/**
 * BaseModel 抽象类
 * 定义AI模型实现的接口
 */
export abstract class BaseModel {
  /**
   * 发送聊天消息并获取响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @returns 包含聊天响应的Promise
   */
  abstract unifiedChat<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T
  ): Promise<ResponseTypeForOptions<T>>

  /**
   * 流式返回聊天响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @returns 生成响应内容块的异步生成器
   */
  abstract unifiedChatStream<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T
  ): AsyncGenerator<StreamChunkTypeForOptions<T>, void, unknown>

  /**
   * 获取底层模型实例
   * @returns 模型实例或标识符
   */
  abstract getDefaultModel(): string

  /**
   * 检查模型是否原生支持工具/函数
   * @returns 是否支持工具
   */
  supportsTools(_model?: string): boolean {
    return false // 默认不支持，子类可以覆盖此方法
  }

  /**
   * 检查模型是否原生支持系统消息
   * @returns 是否支持系统消息
   */
  supportsSystemMessages(_model?: string): boolean {
    return false // 默认不支持，子类可以覆盖此方法
  }

  /**
   * 将统一格式的工具转换为模型特定的格式
   * @param tools 统一格式的工具定义列表
   * @returns 模型特定格式的工具定义
   */
  convertToolsFormat(tools: AgentFunction[]): any {
    // 默认实现返回基本工具结构
    // 具体模型可以覆盖此方法实现特定的转换逻辑
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }))
  }
}
