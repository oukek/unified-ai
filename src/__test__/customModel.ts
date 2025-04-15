import type {
  Content,
  GenerateContentResponse,
  GenerationConfig,
  Part,
  SafetySetting,
} from '@google/genai'
import type {
  ChatMessage,
  ChatOptions,
  ResponseTypeForOptions,
  StreamChunkTypeForOptions,
} from '../types'
import { GoogleGenAI } from '@google/genai'
import { BaseModel } from '../base'
import {
  ResponseFormat,
  ChatRole as UnifiedChatRole,
} from '../types'
import { JsonHelper } from '../utils'

/**
 * Gemini API 参数接口
 */
export interface GeminiOptions {
  /** API 密钥 */
  apiKey: string
  /** 模型名称，默认为 "gemini-pro" */
  model?: string
  /** 生成配置 */
  generationConfig?: GenerationConfig
  /** 安全设置 */
  safetySettings?: SafetySetting[]
}

/**
 * Gemini 模型类
 * 基于 Google Generative AI SDK 的实现
 */
export class CustomModel extends BaseModel {
  private ai: GoogleGenAI
  private modelName: string

  /**
   * 构造函数
   * @param options Gemini 配置选项
   */
  constructor(options: GeminiOptions) {
    super()
    this.ai = new GoogleGenAI({ apiKey: options.apiKey })
    this.modelName = options.model || 'gemini-2.0-flash'
  }

  /**
   * 获取底层模型实例
   * @returns 模型名称
   */
  getDefaultModel(): string {
    return this.modelName
  }

  /**
   * 检查模型是否原生支持工具/函数
   * @returns 是否支持工具
   */
  supportsTools(): boolean {
    return false // Gemini支持工具
  }

  /**
   * 检查模型是否原生支持系统消息
   * @returns 是否支持系统消息
   */
  supportsSystemMessages(): boolean {
    return false // Gemini不直接支持系统消息
  }

  /**
   * 将统一聊天消息转换为 Gemini 格式内容
   * @param messages 统一格式的聊天消息
   * @returns Gemini 格式的内容数组
   */
  private convertMessagesToGeminiFormat(messages: ChatMessage[]): Content[] {
    // 处理系统消息和常规消息
    const contents: Content[] = []
    let systemInstruction = ''

    for (const message of messages) {
      if (message.role === UnifiedChatRole.SYSTEM) {
        // 收集系统消息内容
        if (systemInstruction) {
          systemInstruction += '\n\n'
        }
        systemInstruction += message.content
      }
      else {
        // 添加用户或助手消息
        const role = message.role === UnifiedChatRole.USER ? 'user' : 'model'
        contents.push({
          role,
          parts: [{ text: message.content }],
        })
      }
    }

    return contents
  }

  /**
   * 将 Gemini 响应转换为统一格式
   * @param response Gemini 响应
   * @param options 聊天请求选项
   * @returns 统一格式的聊天响应
   */
  private convertGeminiResponseToUnified<T extends ChatOptions | undefined>(
    response: GenerateContentResponse,
    options?: T,
  ): ResponseTypeForOptions<T> {
    // 获取文本内容
    const rawText = response.text || ''
    let content: any = rawText
    const isJsonMode = options?.responseFormat === ResponseFormat.JSON

    if (isJsonMode) {
      try {
        // 尝试解析JSON
        content = JsonHelper.safeParseJson(rawText)
      }
      catch {
        // JSON解析失败，尝试修复
        content = rawText
        // 但由于请求的是JSON格式，需要记录错误
        console.error(`无法解析或修复JSON响应`)
      }
    }

    // 构建基本响应
    const chatResponse = {
      content,
      isJsonResponse: isJsonMode && typeof content !== 'string',
      model: this.modelName,
      usage: {
        // Gemini API 目前不提供 token 使用情况，置为 undefined
        promptTokens: undefined,
        completionTokens: undefined,
        totalTokens: undefined,
      },
    } as ResponseTypeForOptions<T>

    return chatResponse
  }

  /**
   * 统一接口：发送聊天消息并获取响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @returns 包含聊天响应的Promise
   */
  async unifiedChat<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T,
  ): Promise<ResponseTypeForOptions<T>> {
    try {
      // 构建消息历史
      let geminiInput: Content[]

      if (options?.history && options.history.length > 0) {
        // 如果有历史记录，将历史记录转换为 Gemini 格式
        geminiInput = this.convertMessagesToGeminiFormat(options.history)

        // 添加当前用户消息
        geminiInput.push({
          role: 'user',
          parts: [{ text: prompt }] as Part[],
        })
      }
      else {
        // 没有历史记录，只有当前用户消息
        geminiInput = [
          {
            role: 'user',
            parts: [{ text: prompt }] as Part[],
          },
        ]
      }

      // 转换选项
      const geminiOptions: GenerationConfig = {}
      if (options?.temperature !== undefined) {
        geminiOptions.temperature = options.temperature
      }
      if (options?.maxTokens !== undefined) {
        geminiOptions.maxOutputTokens = options.maxTokens
      }

      // 如果是JSON模式，添加系统指令提示
      if (options?.responseFormat === ResponseFormat.JSON) {
        // 在用户输入前添加指令，确保模型以JSON格式返回
        const jsonInstruction = {
          role: 'user',
          parts: [{ text: 'Please return your response in valid JSON format only, without any non-JSON text.' }] as Part[],
        }
        geminiInput.unshift(jsonInstruction)
      }

      // 调用 Gemini API
      const response = await this.ai.models.generateContent({
        model: this.modelName,
        contents: geminiInput,
        config: geminiOptions,
      })

      // 转换为统一格式并返回
      return this.convertGeminiResponseToUnified(response, options)
    }
    catch (error: any) {
      throw new Error(`Gemini API 错误: ${error.message}`)
    }
  }

  /**
   * 统一接口：流式返回聊天响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @returns 生成响应内容块的异步生成器
   */
  async* unifiedChatStream<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T,
  ): AsyncGenerator<StreamChunkTypeForOptions<T>, void, unknown> {
    try {
      // 构建消息历史
      let geminiInput: Content[]

      if (options?.history && options.history.length > 0) {
        // 如果有历史记录，将历史记录转换为 Gemini 格式
        geminiInput = this.convertMessagesToGeminiFormat(options.history)

        // 添加当前用户消息
        geminiInput.push({
          role: 'user',
          parts: [{ text: prompt }] as Part[],
        })
      }
      else {
        // 没有历史记录，只有当前用户消息
        geminiInput = [
          {
            role: 'user',
            parts: [{ text: prompt }] as Part[],
          },
        ]
      }

      // 转换选项
      const geminiOptions: GenerationConfig = {}
      if (options?.temperature !== undefined) {
        geminiOptions.temperature = options.temperature
      }
      if (options?.maxTokens !== undefined) {
        geminiOptions.maxOutputTokens = options.maxTokens
      }

      // 如果是JSON模式，添加系统指令提示
      if (options?.responseFormat === ResponseFormat.JSON) {
        // 在用户输入前添加指令，确保模型以JSON格式返回
        const jsonInstruction = {
          role: 'user',
          parts: [{ text: 'Please return your response in valid JSON format only, without any non-JSON text.' }] as Part[],
        }
        geminiInput.unshift(jsonInstruction)
      }

      // 处理工具参数
      // let tools: GeminiTool[] | undefined
      if (options?.tools && Array.isArray(options.tools)) {
        // tools = this.convertToolsFormat(options.tools)
        // console.log('tools', tools)
      }

      // 调用 Gemini 流式 API
      const streamResult = await this.ai.models.generateContentStream({
        model: this.modelName,
        contents: geminiInput,
        config: geminiOptions,
      })

      // 用于累积JSON流式输出的缓冲区
      let jsonBuffer = ''
      const isJsonMode = options?.responseFormat === ResponseFormat.JSON

      // 在流式过程中，始终使用文本格式发送片段
      for await (const chunk of streamResult) {
        const text = chunk.text
        if (text) {
          if (isJsonMode) {
            // 在JSON模式下，累积内容而不立即解析
            jsonBuffer += text

            // 发送原始文本，内部处理时不进行解析
            const chunkObj = {
              content: text,
              isJsonResponse: false, // 在流式过程中不解析JSON
              isLast: false,
              model: this.modelName,
            } as StreamChunkTypeForOptions<T>

            yield chunkObj
          }
          else {
            // 在文本模式下，正常输出每个块
            const chunkObj = {
              content: text,
              isJsonResponse: false,
              isLast: false,
              model: this.modelName,
            } as StreamChunkTypeForOptions<T>

            yield chunkObj
          }
        }
      }

      // 处理JSON模式的最终输出
      if (isJsonMode && jsonBuffer) {
        let finalContent: any = jsonBuffer
        let isJsonResponse = false

        try {
          // 尝试解析JSON
          finalContent = JsonHelper.safeParseJson(jsonBuffer)
          isJsonResponse = true
        }
        catch {
          // 如果仍无法解析，保留原始文本
          finalContent = jsonBuffer
          console.error(`无法解析或修复流式JSON响应`)
        }

        // 最终块
        const finalChunk = {
          content: finalContent,
          isJsonResponse,
          isLast: true,
          model: this.modelName,
        } as StreamChunkTypeForOptions<T>

        yield finalChunk
      }
      else {
        // 如果不是JSON模式或没有累积的JSON内容
        const finalChunk = {
          content: '',
          isJsonResponse: false,
          isLast: true,
          model: this.modelName,
        } as StreamChunkTypeForOptions<T>

        yield finalChunk
      }
    }
    catch (error: any) {
      throw new Error(`Gemini 流式 API 错误: ${error.message}`)
    }
  }
}
