import type {
  Content,
  GenerateContentResponse,
  GenerationConfig,
  SafetySetting,
} from '@google/genai'
import type {
  AgentFunctionSchema,
  ChatMessage,
  ChatOptions,
  ContentType,
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

// Define IsLast type helper here since it's internal to the types file
type IsLast<T> = T extends { isLast: infer L } ? L : false

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

interface GeminiToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, GeminiToolProperty>
    required: string[]
  }
}

interface GeminiToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  items?: { type: 'string' | 'number' | 'boolean' | 'object', properties?: Record<string, GeminiToolProperty>, required?: string[] } // Only for arrays
  enum?: any[] // Optional enum for string and number
  properties?: Record<string, GeminiToolProperty> // for nested objects.
  required?: string[]
}

function convertSchema(originalSchema: any, name: string): GeminiToolSchema['parameters'] {
  const converted: GeminiToolSchema = {
    name, // Add the name property
    description: originalSchema.description || `A function named ${name}`, // Add a default description if missing
    parameters: {
      type: 'object',
      properties: {},
      required: originalSchema.required || [],
    },
    // removed additionalProperties, doesn't belong at the top level in Gemini's `tools` object,
  }

  for (const propertyName in originalSchema.properties) {
    if (!originalSchema.properties.hasOwnProperty(propertyName)) {
      continue
    }

    const originalProperty = originalSchema.properties[propertyName]
    let convertedProperty: GeminiToolProperty

    switch (originalProperty.type) {
      case 'string':
        convertedProperty = {
          type: 'string',
          description: originalProperty.description,
          enum: originalProperty.enum,
        }
        break
      case 'number':
        convertedProperty = {
          type: 'number',
          description: originalProperty.description,
          enum: originalProperty.enum,
        }
        break
      case 'boolean':
        convertedProperty = {
          type: 'boolean',
          description: originalProperty.description,
        }
        break
      case 'array':
        if (!originalProperty.items) {
          throw new Error(`Array type must specify items property for ${propertyName} in ${name}`)
        }

        const itemsType = originalProperty.items.type
        let items: GeminiToolProperty['items']

        if (itemsType === 'object') {
          // Recursively convert the schema for items of type object

          // type-assertion to shut the compiler up, but it's actually correct.
          const innerProperties: Record<string, GeminiToolProperty> = {}
          const innerRequired: string[] = originalProperty.items.required || []

          for (const itemPropertyName in originalProperty.items.properties) {
            if (originalProperty.items.properties.hasOwnProperty(itemPropertyName)) {
              innerProperties[itemPropertyName] = convertProperty(originalProperty.items.properties[itemPropertyName])
            }
          }
          items = {
            type: 'object',
            properties: innerProperties,
            required: innerRequired,
          }
        }
        else {
          items = { type: itemsType } // keep it simple when items are not objects
        }

        convertedProperty = {
          type: 'array',
          description: originalProperty.description,
          items,
        }
        break
      case 'object':
        convertedProperty = {
          type: 'object',
          description: originalProperty.description,
          properties: {},
          required: originalProperty.required || [],
        }
        for (const objPropertyName in originalProperty.properties) {
          if (originalProperty.properties.hasOwnProperty(objPropertyName)) {
            convertedProperty.properties![objPropertyName] = convertProperty(originalProperty.properties[objPropertyName])
          }
        }
        break
      default:
        throw new Error(`Unsupported type ${originalProperty.type} for ${propertyName} in ${name}`)
    }

    converted.parameters.properties[propertyName] = convertedProperty
  }

  // If no properties are defined in originalSchema, but there are required fields, ensure those fields have at least a minimal "string" definition

  if (Object.keys(originalSchema.properties || {}).length === 0 && originalSchema.required && originalSchema.required.length > 0) {
    originalSchema.required.forEach((requiredField: string) => {
      converted.parameters.properties[requiredField] = {
        type: 'string',
        description: `Missing description for ${requiredField}, please fill this in.`, // IMPORTANT, description is required
      }
    })
  }

  // Handle no properties case - add a placeholder
  if (Object.keys(converted.parameters.properties || {}).length === 0) {
    converted.parameters.properties.placeholder = {
      type: 'string',
      description: 'This function does not require any parameters. This placeholder is for internal use only and should not be passed.',
    }
  }
  return converted.parameters
}

function convertProperty(originalProperty: any): GeminiToolProperty {
  let convertedProperty: GeminiToolProperty
  switch (originalProperty.type) {
    case 'string':
      convertedProperty = {
        type: 'string',
        description: originalProperty.description,
        enum: originalProperty.enum,
      }
      break
    case 'number':
      convertedProperty = {
        type: 'number',
        description: originalProperty.description,
        enum: originalProperty.enum,
      }
      break
    case 'boolean':
      convertedProperty = {
        type: 'boolean',
        description: originalProperty.description,
      }
      break
    case 'object':
      convertedProperty = {
        type: 'object',
        description: originalProperty.description,
      }
      break
    default:
      convertedProperty = {
        type: originalProperty.type,
        description: originalProperty.description,
      }
      break
  }
  return convertedProperty
}

/**
 * Gemini 模型类
 * 基于 Google Generative AI SDK 的实现
 */
export class GeminiModel extends BaseModel {
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
   * 获取默认模型
   * @returns 默认模型名称
   */
  getDefaultModel(): string {
    return this.modelName
  }

  /**
   * 检查模型是否原生支持工具/函数
   * @returns 是否支持工具
   */
  supportsTools(model?: string): boolean {
    switch (model) {
      case 'gemini-1.5-pro':
        return false
      default:
        return true
    }
  }

  /**
   * 检查模型是否原生支持系统消息
   * @returns 是否支持系统消息
   */
  supportsSystemMessages(model?: string): boolean {
    switch (model) {
      case 'gemini-1.5-pro':
        return false
      default:
        return true
    }
  }

  /**
   * 将统一格式的工具转换为Gemini特定的格式
   * @param tools 统一格式的工具定义列表
   * @returns Gemini特定格式的工具定义
   */
  convertToolsFormat(tools: AgentFunctionSchema[]): any {
    if (!tools || tools.length === 0) {
      return undefined
    }

    // 转换为Gemini的工具格式
    return [{
      functionDeclarations: tools.map((tool) => {
        return {
          name: tool.name,
          description: tool.description,
          parameters: convertSchema(tool.parameters, tool.name),
        }
      }),
    }]
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
    // Check for function calls first
    const functionCalls = response.functionCalls || []
    if (functionCalls.length > 0) {
      const functionCallsData = functionCalls.map((call: any) => ({
        name: call.name,
        arguments: call.args,
      }))

      return {
        content: { function_calls: functionCallsData } as unknown as ContentType<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>,
        isJsonResponse: true as T extends { responseFormat: ResponseFormat.JSON } ? true : boolean,
        model: this.modelName,
        usage: {
          promptTokens: undefined,
          completionTokens: undefined,
          totalTokens: undefined,
        },
        functionCalls: functionCallsData,
      } as unknown as ResponseTypeForOptions<T>
    }

    // If no function calls, proceed with text content
    const rawText = response.text
    let content: any = rawText
    const isJsonMode = options?.responseFormat === ResponseFormat.JSON

    if (isJsonMode && rawText) {
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
    options?: T & { systemMessage?: string },
  ): Promise<ResponseTypeForOptions<T>> {
    try {
      // 准备参数
      let contents: Content[] = []
      let systemInstruction: string | undefined

      if (options?.history && options.history.length > 0) {
        // 如果有历史记录，处理历史记录
        const systemMessages = options.history.filter(m => m.role === UnifiedChatRole.SYSTEM)
        if (systemMessages.length > 0) {
          systemInstruction = systemMessages[systemMessages.length - 1].content
        }

        // 转换非系统消息
        contents = this.convertMessagesToGeminiFormat(
          options.history.filter(m => m.role !== UnifiedChatRole.SYSTEM),
        )
      }

      if (options?.systemMessage) {
        systemInstruction = options.systemMessage
      }

      // 添加当前用户消息
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      })

      // 转换选项
      const configOptions: any = {}
      if (options?.temperature !== undefined) {
        configOptions.temperature = options.temperature
      }
      if (options?.maxTokens !== undefined) {
        configOptions.maxOutputTokens = options.maxTokens
      }

      // 调用 Gemini API
      const response = await this.ai.models.generateContent({
        model: options?.model || this.modelName,
        contents,
        config: {
          ...configOptions,
          systemInstruction: systemInstruction ? { text: systemInstruction } : undefined,
          tools: options?.tools,
        },
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
      // 准备参数
      let contents: any[] = []
      let systemInstruction: string | undefined

      if (options?.history && options.history.length > 0) {
        // 如果有历史记录，处理历史记录
        const systemMessages = options.history.filter(m => m.role === UnifiedChatRole.SYSTEM)
        if (systemMessages.length > 0) {
          systemInstruction = systemMessages[systemMessages.length - 1].content
        }

        // 转换非系统消息
        contents = this.convertMessagesToGeminiFormat(
          options.history.filter(m => m.role !== UnifiedChatRole.SYSTEM),
        )
      }

      if (options?.systemMessage) {
        systemInstruction = options.systemMessage
      }

      // 添加当前用户消息
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      })

      // 转换选项
      const configOptions: any = {}
      if (options?.temperature !== undefined) {
        configOptions.temperature = options.temperature
      }
      if (options?.maxTokens !== undefined) {
        configOptions.maxOutputTokens = options.maxTokens
      }

      // 调用 Gemini 流式 API
      const response = await this.ai.models.generateContentStream({
        model: this.modelName,
        contents,
        config: {
          ...configOptions,
          systemInstruction: systemInstruction ? { text: systemInstruction } : undefined,
          tools: options?.tools,
        },
      })

      // 用于累积JSON流式输出的缓冲区
      let jsonBuffer = ''
      const isJsonMode = options?.responseFormat === ResponseFormat.JSON

      // 在流式过程中，处理响应块
      for await (const chunk of response) {
        const functionCalls = chunk.functionCalls || []
        if (functionCalls.length > 0) {
          const functionCallsData = functionCalls.map((call: any) => ({
            name: call.name,
            arguments: call.args,
          }))

          yield {
            content: { function_calls: functionCallsData } as unknown as boolean extends IsLast<{ isLast: true }> ? string : ContentType<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>,
            isJsonResponse: true as T extends { responseFormat: ResponseFormat.JSON } ? boolean : boolean,
            isLast: true,
            model: this.modelName,
            functionCalls: functionCallsData,
          } as unknown as StreamChunkTypeForOptions<T>
          return
        }

        const text = chunk.text || ''
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
