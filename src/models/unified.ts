import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { z } from 'zod'
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
import zodToJsonSchema from 'zod-to-json-schema'
import { BaseModel } from '../base'
import { ResponseFormat } from '../types'
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
      if (tool.parameters instanceof z.ZodObject) {
        parameters = zodToJsonSchema(tool.parameters, {
          strictUnions: true,
        })
      } else {
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
    // 通知开始响应
    callback?.('response_start', { prompt, options })

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
      // 检查是否需要增强提示
      let enhancedPrompt = prompt

      // 准备选项，添加工具信息
      const enhancedOptions = ModelHelpers.prepareOptionsForModel(
        options,
        this.baseModel,
        tools,
      )
      // 如果模型不支持工具，使用提示增强
      if (!this.baseModel.supportsTools(this.getModel(options?.model)) && tools.length > 0) {
        enhancedPrompt = ModelHelpers.enhanceContentWithTools(prompt, tools)
      }

      // 调用基础模型
      const response = await this.baseModel.unifiedChat(enhancedPrompt, enhancedOptions)

      // 保存原始用户提示
      const initialResponse = {
        ...response,
        additionalInfo: {
          ...response.additionalInfo,
          userPrompt: prompt,
        },
      }

      const finalResponse = await this.functionCallProcessor.processFunctionCallsRecursively(
        this.baseModel,
        initialResponse,
        tools,
        0,
        callback,
        enhancedOptions,
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
      callback?.('response_end', { response: finalResponse })

      return finalResponse
    }
    catch (error: any) {
      // 通知发生错误
      callback?.('error', {
        prompt,
        options,
        error: error.message,
      })

      throw error
    }
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
    // 通知开始响应
    callback?.('response_start', { prompt, options })

    try {
      // 检查是否需要增强提示
      let enhancedPrompt = prompt

      const tools = await this.getAllTools()

      // 准备选项，添加工具信息
      const enhancedOptions = ModelHelpers.prepareOptionsForModel(
        options,
        this.baseModel,
        tools,
      )

      // 如果模型不支持工具，使用提示增强
      if (!this.baseModel.supportsTools(this.getModel(options?.model)) && tools.length > 0) {
        enhancedPrompt = ModelHelpers.enhanceContentWithTools(prompt, tools)
      }
      // 流式获取响应
      let fullContent = ''
      let lastChunk = {
        content: '',
        isLast: false,
        model: this.getModel(options?.model),
        isJsonResponse: false,
      } as StreamChunkTypeForOptions<T>

      // 记录所有函数调用
      const allFunctionCalls: FunctionCall[] = []

      // 处理流式响应
      for await (const chunk of this.baseModel.unifiedChatStream(enhancedPrompt, enhancedOptions)) {
        // 在处理过程中始终使用字符串内容
        const chunkContent = typeof chunk.content === 'object'
          ? JSON.stringify(chunk.content)
          : chunk.content as string

        fullContent += chunkContent
        lastChunk = {
          ...chunk,
          content: chunkContent as any, // 确保传递的是文本内容
          isJsonResponse: false as any, // 在流过程中暂不标记为JSON
        } as StreamChunkTypeForOptions<T>

        // 通知收到响应块
        callback?.('response_chunk', { chunk: lastChunk })

        // 传递中间内容
        if (!chunk.isLast) {
          yield lastChunk
        }
      }

      // 解析函数调用
      const functionCalls = FunctionCallParser.parseFunctionCalls(fullContent)

      // 如果有函数调用，处理它们
      if (functionCalls.length > 0) {
        // 通知递归处理开始
        callback?.('recursion_start', {
          initialContent: fullContent,
          functionCalls,
        })

        // 初始化递归深度和完整响应
        let currentDepth = 0
        let currentResponse = {
          content: fullContent as any,
          model: lastChunk.model,
          isJsonResponse: false as any,
          additionalInfo: {
            userPrompt: prompt,
          },
        } as ChatResponse<any>

        // 执行递归函数调用处理
        while (currentDepth < this.functionCallProcessor.maxRecursionDepth) {
          // 解析当前响应中的函数调用
          const currentCalls = FunctionCallParser.parseFunctionCalls(currentResponse.content)
          if (currentCalls.length === 0) {
            break
          }

          // 执行函数调用
          const executedCalls = await FunctionCallExecutor.executeFunctionCalls(currentCalls, tools, callback)

          // 将执行的函数调用添加到所有调用记录中
          allFunctionCalls.push(...executedCalls)

          // 生成函数结果摘要
          const resultsSummary = executedCalls.map(call =>
            `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
          ).join('\n\n')

          const processingChunk = {
            content: `\n\nProcessing function calls...\n` as any,
            isJsonResponse: false as any,
            isLast: false,
            model: lastChunk.model,
            functionCalls: allFunctionCalls, // 附加所有函数调用信息
          } as StreamChunkTypeForOptions<T>

          // 通知接收到响应块
          callback?.('response_chunk', { chunk: processingChunk })

          // 告知用户正在处理函数调用
          yield processingChunk

          // 将当前响应内容处理为字符串
          const currentResponseContent = typeof currentResponse.content === 'object'
            ? JSON.stringify(currentResponse.content, null, 2)
            : currentResponse.content as string

          // 构建新的提示，包含原始响应和函数执行结果
          const followupPrompt = PromptEnhancer.createFollowupPrompt(
            prompt,
            currentResponseContent,
            resultsSummary,
            options?.responseFormat,
          )

          // 获取包含函数结果的后续响应
          const followupResponse = await this.baseModel.unifiedChat(followupPrompt, enhancedOptions)

          // 更新当前响应和递归深度
          currentResponse = followupResponse
          currentDepth++

          // 如果已达到最大递归深度或没有新的函数调用，输出最终结果
          if (currentDepth >= this.functionCallProcessor.maxRecursionDepth || FunctionCallParser.parseFunctionCalls(followupResponse.content).length === 0) {
            // 根据需要将内容转换为JSON对象（仅在最终结果时）
            let finalContent: any = followupResponse.content
            let isJsonResponse: any = followupResponse.isJsonResponse || false

            // 如果请求JSON格式且内容尚未解析为JSON
            if (options?.responseFormat === ResponseFormat.JSON && !isJsonResponse) {
              const contentStr = typeof finalContent === 'object'
                ? JSON.stringify(finalContent)
                : finalContent as string

              try {
                // 尝试解析JSON
                finalContent = JsonHelper.safeParseJson(contentStr)
                isJsonResponse = true
              }
              catch {
                // 如果解析仍失败，保留原样
                finalContent = `\n\nFinal result (JSON parsing failed):\n${contentStr}`
                console.error(`无法解析或修复JSON响应`)
              }
            }
            else if (!isJsonResponse) {
              // 不是JSON响应，添加前缀
              finalContent = `\n\nFinal result:\n${finalContent}`
            }

            const finalChunk = {
              content: finalContent,
              isJsonResponse,
              isLast: true,
              model: lastChunk.model,
              functionCalls: allFunctionCalls, // 附加所有函数调用信息
            } as StreamChunkTypeForOptions<T>

            // 通知递归处理结束
            callback?.('recursion_end', {
              finalContent: finalChunk.content,
              functionCalls: allFunctionCalls,
            })

            // 通知响应结束
            callback?.('response_end', {
              response: {
                content: finalChunk.content,
                isJsonResponse,
                model: finalChunk.model,
                functionCalls: allFunctionCalls,
              },
            })

            // 通知收到响应块
            callback?.('response_chunk', { chunk: finalChunk })

            yield finalChunk
            return
          }
        }
      }

      // 在无函数调用或不自动执行函数的情况下处理JSON格式
      if (options?.responseFormat === ResponseFormat.JSON && !(lastChunk.isJsonResponse as boolean)) {
        // 尝试将最终内容解析为JSON
        try {
          const jsonContent = JsonHelper.safeParseJson(fullContent)
          const finalChunk = {
            content: jsonContent as any,
            isJsonResponse: true as any,
            isLast: true,
            model: lastChunk.model,
            functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
          } as StreamChunkTypeForOptions<T>

          // 通知响应结束
          callback?.('response_end', {
            response: {
              content: jsonContent,
              isJsonResponse: true,
              model: lastChunk.model,
              functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
            },
          })

          yield finalChunk
          return
        }
        catch {
          // 解析失败，尝试修复
          try {
            const jsonContent = JsonHelper.safeParseJson(fullContent)

            const finalChunk = {
              content: jsonContent as any,
              isJsonResponse: true as any,
              isLast: true,
              model: lastChunk.model,
              functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
            } as StreamChunkTypeForOptions<T>

            // 通知响应结束
            callback?.('response_end', {
              response: {
                content: jsonContent,
                isJsonResponse: true,
                model: lastChunk.model,
                functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
              },
            })

            yield finalChunk
            return
          }
          catch (e: any) {
            // 如果修复后仍无法解析，返回原始内容
            console.error(`无法解析或修复JSON响应: ${e.message}`)
          }
        }
      }

      // 通知响应结束
      callback?.('response_end', {
        response: {
          content: lastChunk.content,
          isJsonResponse: lastChunk.isJsonResponse,
          model: lastChunk.model,
          functionCalls: allFunctionCalls.length > 0 ? allFunctionCalls : undefined,
        },
      })

      // 没有函数调用或不自动执行函数时，输出原始最后一块
      yield lastChunk
    }
    catch (error: any) {
      // 通知发生错误
      callback?.('error', {
        prompt,
        options,
        error: error.message,
      })

      throw error
    }
  }
}
