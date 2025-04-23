import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type {
  AgentCallback,
  AgentFunction,
  AgentFunctionSchema,
  ChatOptions,
  ChatResponse,
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
  FunctionCallProcessor,
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
  private functionCallProcessor: FunctionCallProcessor
  private mcpClient?: Client

  /**
   * 构造函数
   * @param baseModel 基础AI模型
   * @param options 配置选项
   */
  constructor(baseModel: BaseModel, options: UnifiedAIOptions = {}) {
    super()
    this.baseModel = baseModel
    this.functions = options.functions || []
    this.functionCallProcessor = new FunctionCallProcessor({
      maxRecursionDepth: options.maxRecursionDepth,
    })
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
  ): Promise<ResponseTypeForOptions<T>> {
    options = options || {} as T

    // 保存原始用户提示，确保它不会在多轮函数调用中丢失
    const originalUserPrompt = prompt

    // 通知开始响应
    callback?.(AgentEventType.RESPONSE_START, { prompt, options })

    try {
      const tools = await this.getAllTools()

      if (options?.responseFormat === ResponseFormat.JSON) {
        prompt += '\n\nPlease return your response in valid JSON format only, without any non-JSON text.'
      }
      if (tools.length > 0) {
        prompt += '\n\n You may need to use tools. Please use tools from the tool list, do not invent tools yourself.'

        if (options?.responseFormat === ResponseFormat.JSON) {
          prompt += '\n\nIf you need to use tools, ignore the JSON format requirement above.'
        }
      }

      // 处理系统消息和提示
      const { enhancedPrompt, enhancedOptions, systemMessage, currentModel }
        = this.handlePromptAndSystemMessage(prompt, options)

      // 准备选项和增强提示
      const { finalOptions, enhancedPrompt: finalPrompt }
        = this.prepareOptionsAndPrompt(enhancedOptions, tools, enhancedPrompt, currentModel)

      // 调用基础模型
      const response = await this.baseModel.unifiedChat(finalPrompt, finalOptions)

      // 保存原始用户提示和系统消息
      const initialResponse = {
        ...response,
        additionalInfo: {
          ...response.additionalInfo,
          userPrompt: originalUserPrompt,
          systemMessage,
        },
      }

      const finalResponse = await this.functionCallProcessor.processFunctionCallsRecursively(
        this.baseModel,
        initialResponse,
        tools,
        0,
        callback,
        finalOptions,
        this.mcpClient,
      ) as unknown as ResponseTypeForOptions<T>

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
      callback?.(AgentEventType.RESPONSE_END, { response: finalResponse })

      return finalResponse
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
   * 处理缓冲区中的函数调用
   * @param buffer 缓冲区内容
   * @param allFunctionCalls 所有函数调用记录
   * @returns 处理后的缓冲区和是否找到新的函数调用
   */
  private processFunctionCallsInBuffer(buffer: string, allFunctionCalls: FunctionCall[]) {
    let foundNewCalls = false

    // 检查缓冲区中是否有函数调用标签
    if (buffer.includes(FunctionCallParser.FUNCTION_CALL_START_TAG)) {
      // 如果找到了开始标签，等待结束标签
      if (buffer.includes(FunctionCallParser.FUNCTION_CALL_END_TAG)) {
        // 解析缓冲区中的函数调用
        const functionCalls = FunctionCallParser.parseFunctionCalls(buffer)

        // 如果找到函数调用，添加到列表中
        if (functionCalls.length > 0) {
          allFunctionCalls.push(...functionCalls)
          foundNewCalls = true
        }

        // 从缓冲区中移除函数调用标签和内容
        buffer = FunctionCallParser.removeTaggedFunctionCalls(buffer)
      }
    }

    return { buffer, foundNewCalls }
  }

  /**
   * 发送缓冲区内容给用户
   * @param buffer 缓冲区内容
   * @param chunk 当前块
   * @param lastChunk 最后一个块引用
   * @param callback 回调函数
   * @returns 新的最后一个块
   */
  private async sendBufferContent(buffer: string, chunk: any, lastChunk: any, callback?: AgentCallback) {
    if (buffer.length > 0) {
      const bufferChunk = {
        ...chunk,
        content: buffer,
        isJsonResponse: false,
        isLast: chunk.isLast,
      }

      lastChunk = bufferChunk

      // 通知收到响应块
      callback?.(AgentEventType.RESPONSE_CHUNK, { chunk: bufferChunk })

      // 返回缓冲区内容
      return bufferChunk
    }
    return lastChunk
  }

  /**
   * 处理函数调用的递归过程
   * @param originalUserPrompt 原始用户提示
   * @param followupPrompt 后续提示
   * @param systemMessage 系统消息
   * @param supportsSystemMessages 是否支持系统消息
   * @param finalOptions 最终选项
   * @param callback 回调函数
   * @param lastChunk 最后一个块信息
   * @param allFunctionCalls 所有函数调用记录
   * @param options 原始选项
   * @returns 最终块和内容
   */
  private async processRecursiveFunctionCalls<T extends ChatOptions | undefined = undefined>(
    originalUserPrompt: string,
    followupPrompt: string,
    systemMessage: string,
    supportsSystemMessages: boolean,
    finalOptions: any,
    callback?: AgentCallback,
    lastChunk?: any,
    allFunctionCalls: FunctionCall[] = [],
    options?: T,
  ) {
    let followupFullContent = ''
    const intermediateChunks: any[] = []

    // 获取所有中间响应内容
    for await (const followupChunk of this.baseModel.unifiedChatStream(
      supportsSystemMessages ? followupPrompt : `${systemMessage}\n\n${followupPrompt}`,
      finalOptions,
    )) {
      // 累积完整响应内容
      const chunkContent = typeof followupChunk.content === 'object'
        ? JSON.stringify(followupChunk.content)
        : followupChunk.content as string

      followupFullContent += chunkContent

      // 如果不是最后一个块，流式返回给用户
      if (!followupChunk.isLast) {
        // 将后续请求的中间块传递给用户
        const intermediateChunk = {
          content: chunkContent as any,
          isJsonResponse: followupChunk.isJsonResponse as any,
          isLast: false,
          model: followupChunk.model,
        }

        // 通知收到响应块
        callback?.(AgentEventType.RESPONSE_CHUNK, { chunk: intermediateChunk })

        // 收集中间块以便返回
        intermediateChunks.push(intermediateChunk)
      }
    }

    // 从最终结果中移除函数调用标签
    let finalContent = followupFullContent
    if (typeof finalContent === 'string') {
      finalContent = FunctionCallParser.removeTaggedFunctionCalls(finalContent)
    }

    // 检查处理后的finalContent是否包含任何新内容
    let hasNewContent = true

    // 获取所有中间块的内容
    const allIntermediateContent = intermediateChunks.map(chunk =>
      typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content),
    ).join('')

    // 获取去除中间块内容后的唯一内容
    let uniqueContent = finalContent
    if (allIntermediateContent && typeof finalContent === 'string') {
      // 如果中间块内容与最终内容完全一致，则无新内容
      if (finalContent === allIntermediateContent) {
        uniqueContent = ''
        hasNewContent = false
      }
      // 如果最终内容以中间块内容开始，则截取剩余部分
      else if (finalContent.startsWith(allIntermediateContent)) {
        uniqueContent = finalContent.substring(allIntermediateContent.length)
      }
      // 其他情况，尝试找出最后一个完整句子作为唯一内容
      else {
        const sentences = finalContent.split(/(?<=[.!?])\s+/)
        const intermediateSentences = allIntermediateContent.split(/(?<=[.!?])\s+/)

        if (sentences.length > intermediateSentences.length) {
          // 获取中间块没有的最后几个句子
          uniqueContent = sentences.slice(intermediateSentences.length).join(' ')
        }
        else {
          // 找不到明确的新内容
          uniqueContent = ''
          hasNewContent = false
        }
      }
    }

    // 如果没有新内容，但最终结果不为空，尝试提取最后一部分
    if (!hasNewContent && finalContent && typeof finalContent === 'string' && finalContent.trim()) {
      const contentParts = finalContent.split('\n\n')
      if (contentParts.length > 0) {
        // 取最后一个段落
        uniqueContent = contentParts[contentParts.length - 1]

        // 检查这个段落是否是中间块的最后部分
        const intermediateEndings = intermediateChunks.length > 0
          ? intermediateChunks[intermediateChunks.length - 1].content
          : ''

        // 如果最后部分也重复了，则真的没有新内容
        if (intermediateEndings && uniqueContent === intermediateEndings) {
          uniqueContent = ''
          hasNewContent = false
        }
        else {
          hasNewContent = true
        }
      }
    }

    // 处理JSON格式响应
    const { processedContent, isJsonResponse } = this.processJsonResponse(
      uniqueContent, // 使用处理后的唯一内容
      options && 'responseFormat' in options ? options.responseFormat === ResponseFormat.JSON : false,
      false,
    )

    const finalChunk: {
      content: any
      isJsonResponse: boolean
      isLast: boolean
      model?: string
      functionCalls?: FunctionCall[]
      intermediateChunks?: any[]
      hasNewContent: boolean
    } = {
      content: processedContent, // 使用处理后的唯一内容
      isJsonResponse,
      isLast: true,
      model: lastChunk?.model,
      functionCalls: allFunctionCalls, // 附加所有函数调用信息
      intermediateChunks, // 收集的中间块，设为可选属性
      hasNewContent, // 标记是否包含新内容
    }

    // 通知递归处理结束
    callback?.(AgentEventType.RECURSION_END, {
      finalContent: finalChunk.content,
      functionCalls: allFunctionCalls,
      response: {
        content: finalChunk.content,
        isJsonResponse,
        model: finalChunk.model as string,
      },
      depth: 0,
      completedFunctionCalls: allFunctionCalls,
    })

    // 通知响应结束
    callback?.(AgentEventType.RESPONSE_END, {
      response: {
        content: finalChunk.content,
        isJsonResponse,
        model: finalChunk.model as string,
      },
    })

    return finalChunk
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
   * 执行函数调用并生成后续提示
   * @param currentCalls 当前函数调用列表
   * @param tools 工具列表
   * @param callback 回调函数
   * @param originalUserPrompt 原始用户提示
   * @param currentResponseContent 当前响应内容
   * @param responseFormat 响应格式
   * @returns 执行结果和新提示
   */
  private async executeFunctionsAndGeneratePrompt(
    currentCalls: FunctionCall[],
    tools: AgentFunctionSchema[],
    callback?: AgentCallback,
    originalUserPrompt?: string,
    currentResponseContent?: string,
    responseFormat?: ResponseFormat,
  ) {
    // 执行函数调用
    const executedCalls = await FunctionCallExecutor.executeFunctionCalls(currentCalls, tools, callback, this.mcpClient)

    // 生成函数结果摘要
    const resultsSummary = executedCalls.map(call =>
      `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
    ).join('\n\n')

    // 构建新的提示，包含原始响应和函数执行结果
    const followupPrompt = originalUserPrompt && currentResponseContent
      ? PromptEnhancer.createFollowupPrompt(
          originalUserPrompt,
          currentResponseContent,
          resultsSummary,
          responseFormat,
        )
      : resultsSummary

    return { executedCalls, followupPrompt }
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
  ): AsyncGenerator<StreamChunkTypeForOptions<T>, void, unknown> {
    // 保存原始用户提示，确保它不会在多轮函数调用中丢失
    const originalUserPrompt = prompt

    // 通知开始响应
    callback?.(AgentEventType.RESPONSE_START, { prompt, options })

    try {
      // 处理系统消息和提示
      const { enhancedPrompt, enhancedOptions, systemMessage, currentModel, supportsSystemMessages }
        = this.handlePromptAndSystemMessage(prompt, options)

      // 获取所有工具
      const tools = await this.getAllTools()

      // 准备选项和增强提示
      const { finalOptions, enhancedPrompt: finalPrompt }
        = this.prepareOptionsAndPrompt(enhancedOptions, tools, enhancedPrompt, currentModel)

      // 流式获取响应
      let fullContent = ''
      let buffer = '' // 用于累积内容的缓冲区
      let lastChunk = {
        content: '',
        isLast: false,
        model: currentModel,
        isJsonResponse: false,
      } as StreamChunkTypeForOptions<T>

      // 记录所有函数调用
      const allFunctionCalls: FunctionCall[] = []

      // 存储已发送的完整内容，用于检测重复
      const allSentContent: string[] = []

      // 最小缓冲区大小，确保能检测到函数调用标签
      const MIN_BUFFER_SIZE = 22 // <==start_tool_calls==> 长度为21

      // 处理流式响应
      for await (const chunk of this.baseModel.unifiedChatStream(finalPrompt, finalOptions)) {
        // 处理直接返回的函数调用
        if (chunk.functionCalls && chunk.functionCalls.length > 0) {
          // 直接把缓冲区的内容发送了
          if (buffer.length > 0) {
            // 检查是否已发送过相同内容
            if (!this.isContentDuplicate(buffer, allSentContent)) {
              // 记录已发送内容
              allSentContent.push(buffer)

              const bufferChunk = await this.sendBufferContent(buffer, chunk, lastChunk, callback)
              yield bufferChunk as StreamChunkTypeForOptions<T>
            }

            // 清空缓冲区
            buffer = ''
          }
          fullContent = ''
          chunk.content = JSON.stringify({
            function_calls: chunk.functionCalls,
          })
        }

        // 在处理过程中始终使用字符串内容
        const chunkContent = typeof chunk.content === 'object'
          ? JSON.stringify(chunk.content)
          : chunk.content as string

        fullContent += chunkContent

        // 将当前块添加到缓冲区
        buffer += chunkContent

        // 处理缓冲区中的函数调用
        const bufferResult = this.processFunctionCallsInBuffer(buffer, allFunctionCalls)
        buffer = bufferResult.buffer

        // 如果是最后一个块，处理函数调用
        if (chunk.isLast) {
          // 解析函数调用
          const functionCalls = FunctionCallParser.parseFunctionCalls(fullContent)

          // 如果有函数调用，处理它们
          if (functionCalls.length > 0 || allFunctionCalls.length > 0) {
            // 通知递归处理开始
            callback?.(AgentEventType.RECURSION_START, {
              initialContent: fullContent,
              functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : functionCalls,
              depth: 0,
            })

            // 初始化递归深度和完整响应
            let currentDepth = 0
            let currentResponse = {
              content: fullContent as any,
              model: lastChunk.model,
              isJsonResponse: false as any,
              additionalInfo: {
                userPrompt: originalUserPrompt,
                systemMessage,
              },
            } as ChatResponse<any>

            // 从完整响应中移除函数调用标签
            if (typeof currentResponse.content === 'string') {
              currentResponse.content = FunctionCallParser.removeTaggedFunctionCalls(currentResponse.content as string)
            }

            // 执行递归函数调用处理
            while (currentDepth < this.functionCallProcessor.maxRecursionDepth) {
              // 解析当前响应中的函数调用
              const currentCalls = allFunctionCalls.length > 0
                ? allFunctionCalls.filter(call => !call.result) // 只处理未执行的函数调用
                : FunctionCallParser.parseFunctionCalls(currentResponse.content)

              // 清空已处理的函数调用列表
              allFunctionCalls.length = 0

              if (currentCalls.length === 0) {
                break
              }

              // 执行函数调用并生成后续提示
              const currentResponseContent = typeof currentResponse.content === 'object'
                ? JSON.stringify(currentResponse.content, null, 2)
                : currentResponse.content as string

              const { executedCalls, followupPrompt } = await this.executeFunctionsAndGeneratePrompt(
                currentCalls,
                tools,
                callback,
                originalUserPrompt,
                currentResponseContent,
                options && 'responseFormat' in options ? options.responseFormat : undefined,
              )

              // 将执行的函数调用添加到所有调用记录中
              allFunctionCalls.push(...executedCalls)

              // 为后续调用准备选项
              let followupOptions = { ...finalOptions }

              // 如果模型不支持系统消息，处理系统消息
              if (systemMessage && !supportsSystemMessages) {
                followupOptions = {
                  ...followupOptions,
                  systemMessage: '', // 清空系统消息，因为会合并到提示中
                }
              }

              // 处理递归调用并获取最终结果
              const recursiveResult = await this.processRecursiveFunctionCalls<T>(
                originalUserPrompt,
                followupPrompt,
                systemMessage,
                supportsSystemMessages,
                followupOptions,
                callback,
                lastChunk,
                allFunctionCalls,
                options,
              )

              // 更新当前响应和递归深度
              currentResponse = {
                content: recursiveResult.content as any,
                model: lastChunk.model,
                isJsonResponse: recursiveResult.isJsonResponse as any,
              } as ChatResponse<any>
              currentDepth++

              // 如果已达到最大递归深度或没有新的函数调用，输出最终结果
              if (currentDepth >= this.functionCallProcessor.maxRecursionDepth
                || FunctionCallParser.parseFunctionCalls(
                  typeof currentResponse.content === 'string'
                    ? currentResponse.content
                    : JSON.stringify(currentResponse.content),
                ).length === 0) {
                // 先输出中间块，同时记录已发送内容
                if (recursiveResult.intermediateChunks) {
                  for (const chunk of recursiveResult.intermediateChunks) {
                    const chunkContent = typeof chunk.content === 'string'
                      ? chunk.content
                      : JSON.stringify(chunk.content)

                    // 记录已发送内容
                    if (chunkContent) {
                      allSentContent.push(chunkContent)
                    }

                    yield chunk as StreamChunkTypeForOptions<T>
                  }
                }

                // 删除中间块属性再输出最终块
                const finalResult = { ...recursiveResult } as any
                if (finalResult.intermediateChunks) {
                  delete finalResult.intermediateChunks
                }

                // 检查是否有新内容
                if (!finalResult.hasNewContent) {
                  // 如果没有新内容，不发送最终块
                  delete finalResult.hasNewContent
                  return
                }

                // 删除标记属性
                delete finalResult.hasNewContent

                // 确保最终内容不是空的
                const finalContent = typeof finalResult.content === 'string'
                  ? finalResult.content.trim()
                  : finalResult.content

                if (!finalContent && typeof finalResult.content === 'string') {
                  return // 如果是空内容，不发送
                }

                // 检查最终内容是否与已发送内容重复
                const finalContentStr = typeof finalResult.content === 'string'
                  ? finalResult.content
                  : JSON.stringify(finalResult.content)

                if (this.isContentDuplicate(finalContentStr, allSentContent)) {
                  // 如果内容重复，不发送
                  return
                }

                yield finalResult as StreamChunkTypeForOptions<T>
                return
              }
            }
          }
        }

        // 只有当缓冲区大于最小大小或是最后一个块时才发送内容
        if (buffer.length >= MIN_BUFFER_SIZE || chunk.isLast) {
          // 检查缓冲区是否有完整的函数调用标签对
          while (FunctionCallParser.hasCompleteFunctionCallTags(buffer)) {
            // 解析并移除所有函数调用
            const functionCalls = FunctionCallParser.parseFunctionCalls(buffer)
            if (functionCalls.length > 0) {
              allFunctionCalls.push(...functionCalls)
            }
            buffer = FunctionCallParser.removeTaggedFunctionCalls(buffer)
          }

          // 发送累积的内容
          if (buffer.length > 0) {
            // 检查是否与已发送内容重复
            if (!this.isContentDuplicate(buffer, allSentContent)) {
              // 记录已发送内容
              allSentContent.push(buffer)

              const bufferChunk = await this.sendBufferContent(buffer, chunk, lastChunk, callback)
              yield bufferChunk as StreamChunkTypeForOptions<T>

              // 更新最后一个块引用
              lastChunk = bufferChunk
            }

            // 清空缓冲区
            buffer = ''
          }
        }
      }

      // 在无函数调用或不自动执行函数的情况下处理JSON格式
      if (options && 'responseFormat' in options && options.responseFormat === ResponseFormat.JSON && !(lastChunk.isJsonResponse as boolean)) {
        // 尝试将最终内容解析为JSON
        try {
          const { processedContent, isJsonResponse } = this.processJsonResponse(fullContent, true, false)

          const finalChunk = {
            content: processedContent as any,
            isJsonResponse: isJsonResponse as any,
            isLast: true,
            model: lastChunk.model,
            functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
          } as StreamChunkTypeForOptions<T>

          // 通知响应结束
          callback?.(AgentEventType.RESPONSE_END, {
            response: {
              content: processedContent,
              isJsonResponse,
              model: lastChunk.model as string,
            },
          })

          // 检查是否与已发送内容重复
          const finalContentStr = typeof finalChunk.content === 'string'
            ? finalChunk.content
            : JSON.stringify(finalChunk.content)

          if (!this.isContentDuplicate(finalContentStr, allSentContent)) {
            yield finalChunk
          }

          return
        }
        catch (e: any) {
          // 如果修复后仍无法解析，返回原始内容
          console.error(`无法解析或修复JSON响应: ${e.message}`)
        }
      }

      // 通知响应结束
      callback?.(AgentEventType.RESPONSE_END, {
        response: {
          content: lastChunk.content,
          isJsonResponse: lastChunk.isJsonResponse,
          model: lastChunk.model as string,
        },
      })

      // 检查最后一块是否与已发送内容重复
      const lastChunkContent = typeof lastChunk.content === 'string'
        ? lastChunk.content
        : JSON.stringify(lastChunk.content)

      if (!this.isContentDuplicate(lastChunkContent, allSentContent)) {
        yield lastChunk
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
}
