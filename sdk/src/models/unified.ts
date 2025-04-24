import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type {
  AgentCallback,
  AgentFunction,
  AgentFunctionSchema,
  ChatOptions,
  FunctionCall,
  ResponseTypeForOptions,
  StreamChunkTypeForOptions,
  UnifiedAIOptions,
} from '../types'
import { z } from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'
import { BaseModel } from '../base'
import { AgentEventType, ResponseFormat } from '../types'
import {
  FunctionCallExecutor,
  FunctionCallParser,
  JsonHelper,
  ModelHelpers,
  PromptEnhancer,
} from '../utils'

/**
 * 统一AI接口
 * 支持代理功能的AI封装类
 */
export class UnifiedAI extends BaseModel {
  private baseModel: BaseModel
  private functions: AgentFunction[]
  private mcpClient?: Client
  private maxRecursionDepth = 25

  /**
   * 构造函数
   * @param baseModel 基础AI模型
   * @param options 配置选项
   */
  constructor(baseModel: BaseModel, options: UnifiedAIOptions = {}) {
    super()
    this.baseModel = baseModel
    this.functions = options.functions || []
    this.maxRecursionDepth = options.maxRecursionDepth || 25
  }

  /**
   * 获取默认模型
   * @returns 默认模型名称
   */
  getDefaultModel(): string {
    return this.baseModel.getDefaultModel()
  }

  /**
   * 添加代理功能
   * @param function 要添加的功能
   */
  addFunction(func: AgentFunction): void {
    this.functions.push(func)
  }

  /**
   * 添加多个代理功能
   * @param functions 要添加的功能列表
   */
  addFunctions(functions: AgentFunction[]): void {
    this.functions.push(...functions)
  }

  /**
   * 设置MCP客户端
   * @param client MCP SDK客户端实例
   * @returns 当前实例，用于链式调用
   */
  useMcp(client: Client): this {
    this.mcpClient = client
    return this
  }

  async getMcpTools(): Promise<AgentFunction[]> {
    const toolsResponse = await this.mcpClient?.listTools()
    return toolsResponse?.tools?.map(tool => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.inputSchema as unknown as z.ZodObject<any>,
    })) || []
  }

  async getAllTools(): Promise<AgentFunctionSchema[]> {
    const tools = [...this.functions, ...(await this.getMcpTools())]
    return tools.map((tool) => {
      let parameters: Record<string, any> = {}
      if (tool.parameters instanceof z.ZodType) {
        parameters = zodToJsonSchema(tool.parameters, {
          strictUnions: true,
        })
      }
      else {
        parameters = tool.parameters
      }
      delete (parameters as any).$schema
      delete (parameters as any).additionalProperties
      return {
        name: tool.name,
        description: tool.description || '',
        parameters,
        executor: tool.executor,
      }
    })
  }

  getModel(model?: string): string {
    return this.baseModel.getModel(model)
  }

  /**
   * 统一接口：发送聊天消息并获取响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @param callback 回调函数
   * @returns 包含聊天响应的Promise
   */
  async unifiedChat<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T,
    callback?: AgentCallback,
    depth = 0,
    completedFunctions: FunctionCall[] = [],
  ): Promise<ResponseTypeForOptions<T>> {
    options = options || {} as T

    // 保存原始用户提示，确保它不会在多轮函数调用中丢失
    const originalUserPrompt = prompt

    // 通知开始响应
    if (depth === 0) {
      callback?.(AgentEventType.RESPONSE_START, { prompt, options })
    }

    try {
      // 处理系统消息和提示
      const { enhancedPrompt, enhancedOptions, systemMessage, currentModel, supportsSystemMessages }
        = this.handlePromptAndSystemMessage(prompt, options)

      // 获取所有工具
      const tools = await this.getAllTools()

      // 准备选项和增强提示
      const { finalOptions, enhancedPrompt: finalPrompt }
        = this.prepareOptionsAndPrompt(enhancedOptions, tools, enhancedPrompt, currentModel)

      // 调用基础模型
      const response = await this.baseModel.unifiedChat(finalPrompt, finalOptions)

      // 解析函数调用
      const functionCalls = FunctionCallParser.parseFunctionCalls(response.content)

      // 如果没有函数调用或已达到最大递归深度，直接返回响应
      if (functionCalls.length === 0 || depth >= (this.maxRecursionDepth || 25)) {
        const finalResponse = {
          ...response,
          functionCalls: completedFunctions.length > 0 ? completedFunctions : undefined,
          additionalInfo: {
            ...response.additionalInfo,
            userPrompt: originalUserPrompt,
            systemMessage,
          },
        } as unknown as ResponseTypeForOptions<T>

        // 确保在JSON模式下返回解析后的JSON对象
        if (options?.responseFormat === ResponseFormat.JSON && !finalResponse.isJsonResponse) {
          // 如果需要返回JSON但还未解析，在最终结果时解析
          const contentStr = typeof finalResponse.content === 'string'
            ? finalResponse.content
            : JSON.stringify(finalResponse.content)

          try {
            // 尝试解析JSON
            (finalResponse as any).content = JsonHelper.safeParseJson(contentStr)
            finalResponse.isJsonResponse = true as any
          }
          catch {
            console.error(`无法解析或修复JSON响应`)
          }
        }

        // 通知响应结束
        if (depth === 0) {
          callback?.(AgentEventType.RESPONSE_END, { response: finalResponse })
        }

        return finalResponse
      }

      // 通知递归处理开始
      callback?.(AgentEventType.RECURSION_START, {
        initialContent: response.content,
        functionCalls,
        depth,
      })

      // 执行函数调用
      const executedCalls = await FunctionCallExecutor.executeFunctionCalls(
        functionCalls,
        tools,
        callback,
        this.mcpClient,
      )

      // 所有已执行的函数调用
      const allExecutedCalls = [
        ...executedCalls,
        ...completedFunctions,
      ]

      // 生成函数结果摘要
      const resultsSummary = allExecutedCalls.map(call =>
        `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
      ).join('\n\n')

      // 清理内容中的函数调用标记
      const cleanContent = typeof response.content === 'string'
        ? FunctionCallParser.removeTaggedFunctionCalls(response.content)
        : JSON.stringify(response.content)

      // 构建后续提示
      const followupPrompt = originalUserPrompt
        ? PromptEnhancer.createFollowupPrompt(
            originalUserPrompt,
            cleanContent,
            resultsSummary,
            options?.responseFormat,
          )
        : resultsSummary

      // 准备递归选项
      const followupOptions = { ...options } as T & ChatOptions
      if (systemMessage && !supportsSystemMessages) {
        followupOptions.systemMessage = ''
      }

      // 如果深度太大，停止递归
      if (depth >= (this.maxRecursionDepth || 25) - 1) {
        const finalResponse = {
          content: `已达到最大递归深度(${depth + 1})。最终结果可能不完整。\n\n${cleanContent}`,
          isJsonResponse: false,
          model: currentModel,
          functionCalls: allExecutedCalls,
          isLast: true,
          additionalInfo: {
            completedFunctions: completedFunctions.length > 0 ? completedFunctions : undefined,
            userPrompt: originalUserPrompt,
            systemMessage,
          },
        } as unknown as ResponseTypeForOptions<T>

        // 通知响应结束
        if (depth === 0) {
          callback?.(AgentEventType.RESPONSE_END, { response: finalResponse })
        }

        return finalResponse
      }

      // 递归处理：使用函数调用结果生成新的提示
      return this.unifiedChat(
        supportsSystemMessages ? followupPrompt : `${systemMessage || ''}\n\n${followupPrompt}`,
        followupOptions,
        callback,
        depth + 1,
        allExecutedCalls,
      )
    }
    catch (error: any) {
      // 通知发生错误
      callback?.(AgentEventType.ERROR, {
        prompt,
        options,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * 处理初始提示和系统消息
   * @param prompt 用户提示
   * @param options 聊天选项
   * @returns 增强后的提示和处理后的选项
   */
  private handlePromptAndSystemMessage<T extends ChatOptions | undefined = undefined>(prompt: string, options: T) {
    const systemMessage = options?.systemMessage || ''
    let enhancedPrompt = prompt
    const enhancedOptions = { ...options } as T

    // 判断模型是否支持系统消息
    const currentModel = this.getModel(options?.model)
    const supportsSystemMessages = this.baseModel.supportsSystemMessages?.(currentModel) || false

    if (systemMessage && !supportsSystemMessages) {
      // 如果模型不支持系统消息，将系统消息添加到用户提示的开头
      enhancedPrompt = `${systemMessage}\n\n${prompt}`
      // 从选项中移除系统消息，因为已经合并到提示中
      delete (enhancedOptions as any).systemMessage
    }
    else {
      // 模型支持系统消息，保留在选项中
      (enhancedOptions as any).systemMessage = systemMessage
    }

    return { enhancedPrompt, enhancedOptions, systemMessage, currentModel, supportsSystemMessages }
  }

  /**
   * 准备模型选项和增强提示
   * @param enhancedOptions 处理后的选项
   * @param tools 工具列表
   * @param enhancedPrompt 增强后的提示
   * @param currentModel 当前模型
   * @returns 最终选项和增强提示
   */
  private prepareOptionsAndPrompt(enhancedOptions: any, tools: AgentFunctionSchema[], enhancedPrompt: string, currentModel: string) {
    // 准备选项，添加工具信息
    const finalOptions = ModelHelpers.prepareOptionsForModel(
      enhancedOptions,
      this.baseModel,
      tools,
    )

    // 如果模型不支持工具，使用提示增强
    if (!this.baseModel.supportsTools(currentModel) && tools.length > 0) {
      enhancedPrompt = ModelHelpers.enhanceContentWithTools(enhancedPrompt, tools)
    }

    return { finalOptions, enhancedPrompt }
  }

  /**
   * 处理JSON格式响应
   * @param content 原始内容
   * @param shouldBeJson 是否应该是JSON格式
   * @param currentIsJson 当前是否已是JSON格式
   * @returns 处理后的内容和JSON状态
   */
  private processJsonResponse(content: any, shouldBeJson: boolean, currentIsJson: boolean) {
    let processedContent = content
    let isJsonResponse = currentIsJson

    // 如果请求JSON格式且内容尚未解析为JSON
    if (shouldBeJson && !isJsonResponse) {
      const contentStr = typeof processedContent === 'object'
        ? JSON.stringify(processedContent)
        : processedContent as string

      try {
        // 尝试解析JSON
        processedContent = JsonHelper.safeParseJson(contentStr)
        isJsonResponse = true
      }
      catch {
        // 如果解析仍失败，保留原样
        processedContent = `${contentStr}`
        console.error(`无法解析或修复JSON响应`)
      }
    }
    else if (!isJsonResponse && typeof processedContent === 'string') {
      // 不是JSON响应，确保是字符串
      processedContent = `${processedContent}`
    }

    return { processedContent, isJsonResponse }
  }

  /**
   * 统一接口：流式返回聊天响应
   * @param prompt 提示/消息内容
   * @param options 聊天请求的可选参数
   * @param callback 回调函数
   * @returns 生成响应内容块的异步生成器
   */
  async* unifiedChatStream<T extends ChatOptions | undefined = undefined>(
    prompt: string,
    options?: T,
    callback?: AgentCallback,
    depth = 0,
    sentContents: string[] = [],
    completedFunctions: FunctionCall[] = [],
  ): AsyncGenerator<StreamChunkTypeForOptions<T>, void, unknown> {
    // 保存原始用户提示，确保它不会在多轮函数调用中丢失
    const originalUserPrompt = prompt

    // 通知开始响应
    if (depth === 0) {
      callback?.(AgentEventType.RESPONSE_START, { prompt, options })
    }

    try {
      // 处理系统消息和提示
      const { enhancedPrompt, enhancedOptions, systemMessage, currentModel, supportsSystemMessages }
        = this.handlePromptAndSystemMessage(prompt, options)

      // 获取所有工具
      const tools = await this.getAllTools()

      // 准备选项和增强提示
      const { finalOptions, enhancedPrompt: finalPrompt }
        = this.prepareOptionsAndPrompt(enhancedOptions, tools, enhancedPrompt, currentModel)

      // 流式获取初始响应
      let fullContent = ''
      let buffer = '' // 用于累积内容的缓冲区
      const allFunctionCalls: FunctionCall[] = []

      // 初始响应处理
      for await (const chunk of this.baseModel.unifiedChatStream(finalPrompt, finalOptions)) {
        // 处理直接返回的函数调用
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          // 确保不添加重复的函数调用
          const newChunkCalls = chunk.functionCalls
            .map(call => call as FunctionCall)
            .filter(call => !allFunctionCalls.some(existingCall =>
              this.isFunctionCallsEqual(call, existingCall),
            ))

          if (newChunkCalls.length > 0) {
            allFunctionCalls.push(...newChunkCalls)
          }

          // 发送缓冲区内容
          if (buffer.length > 0 && !this.isContentDuplicate(buffer, sentContents)) {
            sentContents.push(buffer)
            const bufferChunk = {
              ...chunk,
              content: buffer,
              functionCalls: undefined,
              isLast: false,
            }
            callback?.(AgentEventType.RESPONSE_CHUNK, { chunk: bufferChunk })
            yield bufferChunk as unknown as StreamChunkTypeForOptions<T>
            buffer = ''
          }
        }

        // 将当前块内容添加到累积内容中
        const chunkContent = typeof chunk.content === 'object'
          ? JSON.stringify(chunk.content)
          : chunk.content as string

        fullContent += chunkContent
        buffer += chunkContent

        // 解析缓冲区中的函数调用
        const parsedCalls = FunctionCallParser.parseFunctionCalls(buffer)
        if (parsedCalls.length > 0) {
          // 过滤掉已经存在的函数调用
          const newParsedCalls = parsedCalls.filter(call =>
            !allFunctionCalls.some(existingCall =>
              this.isFunctionCallsEqual(call, existingCall),
            ),
          )

          if (newParsedCalls.length > 0) {
            allFunctionCalls.push(...newParsedCalls)
          }

          buffer = FunctionCallParser.removeTaggedFunctionCalls(buffer)
        }

        // 检查是否有足够的内容发送
        if (buffer.length > 20 || chunk.isLast) {
          if (buffer.length > 0 && !this.isContentDuplicate(buffer, sentContents)) {
            sentContents.push(buffer)
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              buffer = ''
            }
            const bufferChunk = { ...chunk, content: buffer, isLast: false }
            callback?.(AgentEventType.RESPONSE_CHUNK, { chunk: bufferChunk })
            yield bufferChunk as unknown as StreamChunkTypeForOptions<T>
          }
          buffer = ''
        }

        // 如果是最后一个块，准备处理函数调用
        if (chunk.isLast) {
          // 从完整响应中解析函数调用
          const functionCalls = FunctionCallParser.parseFunctionCalls(fullContent)
          if (functionCalls.length > 0) {
            // 更严格的去重逻辑：只添加尚未存在的函数调用
            const newCalls = functionCalls.filter(call =>
              !allFunctionCalls.some(existingCall =>
                this.isFunctionCallsEqual(call, existingCall),
              ),
            )
            // 仅添加新的函数调用
            if (newCalls.length > 0) {
              allFunctionCalls.push(...newCalls)
            }
          }

          // 如果有函数调用，执行它们并递归处理
          if (allFunctionCalls.length > 0) {
            // 通知递归处理开始
            callback?.(AgentEventType.RECURSION_START, {
              initialContent: fullContent,
              functionCalls: allFunctionCalls,
              depth,
            })

            // 执行函数调用
            const executedCalls = await FunctionCallExecutor.executeFunctionCalls(
              allFunctionCalls.filter(call => !call.result),
              tools,
              callback,
              this.mcpClient,
            )

            // 所有已执行的函数调用
            const allExecutedCalls = [
              ...allFunctionCalls.filter(call => call.result),
              ...executedCalls,
              ...completedFunctions,
            ]

            // 生成函数结果摘要
            const resultsSummary = allExecutedCalls.map(call =>
              `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
            ).join('\n\n')

            // 清理内容中的函数调用标记
            const cleanContent = FunctionCallParser.removeTaggedFunctionCalls(fullContent)

            // 构建后续提示
            const followupPrompt = originalUserPrompt
              ? PromptEnhancer.createFollowupPrompt(
                  originalUserPrompt,
                  cleanContent,
                  resultsSummary,
                  options?.responseFormat,
                )
              : resultsSummary

            // 准备递归选项
            const followupOptions = { ...options } as T & ChatOptions
            if (systemMessage && !supportsSystemMessages) {
              followupOptions.systemMessage = ''
            }

            // 如果深度太大，停止递归
            if (depth >= (this.maxRecursionDepth || 25) - 1) {
              const finalChunk = {
                content: `已达到最大递归深度(${depth + 1})。最终结果可能不完整。\n\n${cleanContent}` as any,
                isJsonResponse: false as any,
                isLast: true,
                model: currentModel,
                functionCalls: allExecutedCalls,
                additionalInfo: {
                  completedFunctions: completedFunctions.length > 0 ? completedFunctions : undefined,
                },
              }

              callback?.(AgentEventType.RESPONSE_END, {
                response: {
                  content: finalChunk.content,
                  isJsonResponse: false,
                  model: finalChunk.model,
                },
              })

              yield finalChunk as unknown as StreamChunkTypeForOptions<T>
              return
            }

            // 递归处理：使用函数调用结果生成新的提示
            yield* this.unifiedChatStream(
              supportsSystemMessages ? followupPrompt : `${systemMessage || ''}\n\n${followupPrompt}`,
              followupOptions,
              callback,
              depth + 1,
              sentContents,
              allExecutedCalls,
            )
            return
          }
        }
      }

      // 没有函数调用，确保发送最终结果
      if (buffer.length > 0 && !this.isContentDuplicate(buffer, sentContents)) {
        const finalChunk = {
          content: buffer,
          isLast: true,
          model: currentModel,
          isJsonResponse: false,
          additionalInfo: {
            completedFunctions: completedFunctions.length > 0 ? completedFunctions : undefined,
          },
        }

        // 处理JSON格式
        if (options?.responseFormat === ResponseFormat.JSON) {
          try {
            const { processedContent, isJsonResponse } = this.processJsonResponse(buffer, true, false)
            finalChunk.content = processedContent
            finalChunk.isJsonResponse = isJsonResponse
          }
          catch (e) {
            console.error('JSON处理失败', e)
          }
        }

        callback?.(AgentEventType.RESPONSE_CHUNK, { chunk: finalChunk })

        // 只有在根调用时才通知响应结束
        if (depth === 0) {
          callback?.(AgentEventType.RESPONSE_END, {
            response: {
              content: finalChunk.content,
              isJsonResponse: finalChunk.isJsonResponse,
              model: finalChunk.model,
              additionalInfo: {
                completedFunctions,
              },
            },
          })
        }

        yield finalChunk as unknown as StreamChunkTypeForOptions<T>
      }
    }
    catch (error: any) {
      // 通知发生错误
      callback?.(AgentEventType.ERROR, {
        prompt,
        options,
        error: error.message,
      })

      throw error
    }
  }

  /**
   * 检查内容是否与已发送内容重复
   * @param content 要检查的内容
   * @param sentContents 已发送的内容列表
   * @returns 是否重复
   */
  private isContentDuplicate(content: string, sentContents: string[]): boolean {
    if (!content)
      return false

    // 1. 精确匹配 - 检查是否有完全相同的内容
    if (sentContents.includes(content)) {
      return true
    }

    // 2. 包含关系 - 检查是否已经包含在已发送内容中
    for (const sent of sentContents) {
      if (sent.includes(content) || content.includes(sent)) {
        return true
      }
    }

    // 3. 段落级别比较 - 分解成段落比较
    const contentParagraphs = content.split('\n\n')

    // 如果只有一个段落，已在上面处理过，这里跳过
    if (contentParagraphs.length <= 1) {
      return false
    }

    // 检查所有段落是否都已被发送
    let allParagraphsExist = true
    for (const paragraph of contentParagraphs) {
      if (!paragraph.trim())
        continue // 跳过空段落

      // 检查这个段落是否出现在任何已发送内容中
      let paragraphExists = false
      for (const sent of sentContents) {
        if (sent.includes(paragraph)) {
          paragraphExists = true
          break
        }
      }

      if (!paragraphExists) {
        allParagraphsExist = false
        break
      }
    }

    return allParagraphsExist
  }

  /**
   * 比较两个函数调用是否实质上相同
   * @param call1 第一个函数调用
   * @param call2 第二个函数调用
   * @returns 是否相同
   */
  private isFunctionCallsEqual(call1: FunctionCall, call2: FunctionCall): boolean {
    // 如果两个函数调用的id相同，则认为它们是相同的
    if (call1.id && call2.id && call1.id === call2.id) {
      return true
    }

    // 如果函数名不同，则函数调用一定不同
    if (call1.name !== call2.name) {
      return false
    }

    // 比较参数是否相同
    const args1Str = JSON.stringify(call1.arguments || {})
    const args2Str = JSON.stringify(call2.arguments || {})

    return args1Str === args2Str
  }
}
