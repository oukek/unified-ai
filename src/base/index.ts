import type { ChatOptions, ResponseTypeForOptions, StreamChunkTypeForOptions } from '../types'

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
  abstract getModel(): string
}
