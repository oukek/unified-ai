import type {
  Content as GeminiContent,
  GenerateContentResult,
  GenerateContentStreamResult,
  GenerationConfig,
  GenerativeModel,
  Part,
  SafetySetting,
} from '@google/generative-ai'
import type {
  ChatMessage,
  ChatOptions,
  ResponseTypeForOptions,
  StreamChunkTypeForOptions,
} from '../types'

import {
  GoogleGenerativeAI,
} from '@google/generative-ai'
import { BaseModel } from '../base'
import {
  ChatRole,
  ResponseFormat,
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
export class GeminiModel extends BaseModel {
  private genAI: GoogleGenerativeAI
  private model: GenerativeModel
  private modelName: string

  /**
   * 构造函数
   * @param options Gemini 配置选项
   */
  constructor(options: GeminiOptions) {
    super()
    this.genAI = new GoogleGenerativeAI(options.apiKey)
    this.modelName = options.model || 'gemini-2.0-flash'
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: options.generationConfig,
      safetySettings: options.safetySettings,
    })
  }

  /**
   * 获取底层模型实例
   * @returns 模型名称
   */
  getModel(): string {
    return this.modelName
  }

  /**
   * 将统一聊天消息转换为 Gemini 格式
   * @param messages 统一格式的聊天消息
   * @returns Gemini 格式的消息内容
   */
  private convertMessagesToGeminiFormat(messages: ChatMessage[]): GeminiContent[] {
    return messages.map((message) => {
      const role = message.role === ChatRole.USER
        ? 'user'
        : message.role === ChatRole.ASSISTANT
          ? 'model'
          : 'user' // Gemini 不支持 system 角色，将其视为 user

      return {
        role,
        parts: [{ text: message.content }] as Part[],
      }
    })
  }

  /**
   * 将 Gemini 响应转换为统一格式
   * @param response Gemini 响应
   * @param options 聊天请求选项
   * @returns 统一格式的聊天响应
   */
  private convertGeminiResponseToUnified<T extends ChatOptions | undefined>(
    response: GenerateContentResult,
    options?: T,
  ): ResponseTypeForOptions<T> {
    // 获取文本内容
    const rawText = response.response.text()
    let content: any = rawText
    const isJsonMode = options?.responseFormat === ResponseFormat.JSON

    // JSON模式处理
    if (isJsonMode) {
      try {
        // 尝试解析JSON
        content = JSON.parse(rawText)
      }
      catch {
        // JSON解析失败，尝试修复
        try {
          const repairedJson = JsonHelper.repairJson(rawText)
          content = JSON.parse(repairedJson)
        }
        catch (e: any) {
          // 如果修复后仍然无法解析，则返回原始文本
          content = rawText
          // 但由于请求的是JSON格式，需要记录错误
          console.error(`无法解析或修复JSON响应: ${e.message}`)
        }
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
   * 使用 Gemini 原生格式进行聊天
   * @param prompt 提示内容或消息数组
   * @param options Gemini 特有的选项
   * @returns Gemini 响应
   */
  async chat(
    prompt: string | GeminiContent[],
    options?: GenerationConfig,
  ): Promise<GenerateContentResult> {
    if (typeof prompt === 'string') {
      // 如果是字符串，创建单个用户消息
      return await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: options,
      })
    }
    else {
      // 如果是消息数组，直接使用
      return await this.model.generateContent({
        contents: prompt,
        generationConfig: options,
      })
    }
  }

  /**
   * 使用 Gemini 原生格式进行流式聊天
   * @param prompt 提示内容或消息数组
   * @param options Gemini 特有的选项
   * @returns Gemini 流式响应
   */
  async chatStream(
    prompt: string | GeminiContent[],
    options?: GenerationConfig,
  ): Promise<GenerateContentStreamResult> {
    if (typeof prompt === 'string') {
      // 如果是字符串，创建单个用户消息
      return await this.model.generateContentStream({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: options,
      })
    }
    else {
      // 如果是消息数组，直接使用
      return await this.model.generateContentStream({
        contents: prompt,
        generationConfig: options,
      })
    }
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
      let geminiInput: GeminiContent[]

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
      const response = await this.model.generateContent({
        contents: geminiInput,
        generationConfig: geminiOptions,
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
      let geminiInput: GeminiContent[]

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

      // 调用 Gemini 流式 API
      const streamResult = await this.model.generateContentStream({
        contents: geminiInput,
        generationConfig: geminiOptions,
      })

      // 用于累积JSON流式输出的缓冲区
      let jsonBuffer = ''
      const isJsonMode = options?.responseFormat === ResponseFormat.JSON

      // 在流式过程中，始终使用文本格式发送片段
      for await (const chunk of streamResult.stream) {
        const text = chunk.text()
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
          finalContent = JSON.parse(jsonBuffer)
          isJsonResponse = true
        }
        catch {
          // JSON解析失败，尝试修复
          try {
            const repairedJson = JsonHelper.repairJson(jsonBuffer)
            finalContent = JSON.parse(repairedJson)
            isJsonResponse = true
          }
          catch (e: any) {
            // 如果仍无法解析，保留原始文本
            finalContent = jsonBuffer
            console.error(`无法解析或修复流式JSON响应: ${e.message}`)
          }
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
