import type {
  ChatOptions,
  ChatResponse,
  ResponseTypeForOptions,
  StreamChunkTypeForOptions,
} from '../types'
import { BaseModel } from '../base'
import { ResponseFormat } from '../types'

/**
 * Agent 功能类型
 */
export interface AgentFunction {
  /** 函数名称 */
  name: string
  /** 函数描述 */
  description: string
  /** 函数参数模式 */
  parameters: Record<string, any>
  /** 函数执行器 */
  executor: (params: Record<string, any>) => Promise<any>
}

/**
 * Agent事件类型
 */
export enum AgentEventType {
  /** AI响应开始 */
  RESPONSE_START = 'response_start',
  /** AI响应结束 */
  RESPONSE_END = 'response_end',
  /** AI响应片段 */
  RESPONSE_CHUNK = 'response_chunk',
  /** 函数调用开始 */
  FUNCTION_CALL_START = 'function_call_start',
  /** 函数调用结束 */
  FUNCTION_CALL_END = 'function_call_end',
  /** 递归调用开始 */
  RECURSION_START = 'recursion_start',
  /** 递归调用结束 */
  RECURSION_END = 'recursion_end',
  /** 发生错误 */
  ERROR = 'error',
}

/**
 * Agent事件数据
 */
export interface AgentEvent {
  /** 事件类型 */
  type: AgentEventType
  /** 事件数据 */
  data: any
  /** 时间戳 */
  timestamp: number
}

/**
 * Agent事件回调函数类型
 */
export type AgentEventCallback = (event: AgentEvent) => void | Promise<void>

/**
 * 聊天会话扩展选项
 */
export interface ChatSessionOptions extends ChatOptions {
  /** 事件回调函数 */
  eventCallback?: AgentEventCallback
}

/**
 * UnifiedAI 配置选项
 */
export interface UnifiedAIOptions {
  /** 代理功能 */
  functions?: AgentFunction[]
  /** 最大函数调用递归次数（用于支持链式调用），默认为25 */
  maxRecursionDepth?: number
  /** 其他配置选项 */
  [key: string]: any
}

/**
 * 函数调用结构
 */
export interface FunctionCall {
  /** 函数名称 */
  name: string
  /** 函数参数 */
  arguments: Record<string, any>
  /** 函数执行结果 */
  result?: any
}

/**
 * 增强的聊天响应
 */
export interface EnhancedChatResponse<T extends ResponseFormat | undefined = undefined> extends ChatResponse<T> {
  /** 函数调用详情 */
  functionCalls?: FunctionCall[]
}

/**
 * Agent回调函数类型
 */
export type AgentCallback = (state: string, data: any) => void | Promise<void>

/**
 * 统一AI接口
 * 支持代理功能的AI封装类
 */
export class UnifiedAI extends BaseModel {
  private baseModel: BaseModel
  private functions: AgentFunction[]
  private maxRecursionDepth: number

  /**
   * 构造函数
   * @param baseModel 基础AI模型
   * @param options 配置选项
   */
  constructor(baseModel: BaseModel, options: UnifiedAIOptions = {}) {
    super()
    this.baseModel = baseModel
    this.functions = options.functions || []
    this.maxRecursionDepth = options.maxRecursionDepth ?? 25
  }

  /**
   * 获取底层模型实例
   * @returns 模型实例或标识符
   */
  getModel(): string {
    return this.baseModel.getModel()
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
   * 增强聊天提示
   * @param prompt 原始提示
   * @returns 增强后的提示
   */
  private enhancePrompt(prompt: string): string {
    if (this.functions.length === 0) {
      return prompt
    }

    // 构建函数定义的JSON格式
    const functionDefinitions = this.functions.map(f => ({
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    }))

    // 添加函数说明和规范的调用格式
    return `${prompt}\n\nYou can call the following functions:\n${JSON.stringify(functionDefinitions, null, 2)}\n\n
To call a function, please use only the following standardized JSON format:

For a single function call:
{
  "function_call": {
    "name": "function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

If you need to make multiple function calls at once, use this format:
{
  "function_calls": [
    {
      "name": "first_function_name",
      "arguments": {
        "parameter_name": "parameter_value"
      }
    },
    {
      "name": "second_function_name",
      "arguments": {
        "parameter_name": "parameter_value"
      }
    }
  ]
}

If you need to include function calls within your response, use this format:
{
  "response": "Your text response here",
  "function_call": {
    "name": "function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

If you need to suggest a follow-up function call after seeing the result of the first one:
{
  "response": "Your analysis of the first function call result",
  "next_function_call": {
    "name": "next_function_name",
    "arguments": {
      "parameter_name": "parameter_value"
    }
  }
}

Please use ONLY these exact formats for function calls. Do not invent other formats or property names.`
  }

  /**
   * 解析AI响应中的函数调用
   * @param content AI响应内容
   * @returns 解析的函数调用列表
   */
  private parseFunctionCalls(content: string | Record<string, any>): FunctionCall[] {
    // 如果内容是对象，先转为字符串
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : content as string

    // 查找可能的函数调用格式，支持多种常见格式
    const functionCalls: FunctionCall[] = []

    // 支持的函数调用属性名，与prompt中规定的一致
    const supportedFunctionCallKeys = [
      'function_call',
      'next_function_call',
    ]

    // 尝试解析JSON并提取函数调用
    try {
      // 检查内容是否为完整JSON
      const jsonObj = typeof content === 'object' ? content : JSON.parse(contentStr)

      // 首先检查是否有批量函数调用
      if (jsonObj.function_calls && Array.isArray(jsonObj.function_calls)) {
        for (const call of jsonObj.function_calls) {
          if (call && typeof call === 'object' && call.name) {
            functionCalls.push({
              name: call.name,
              arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
            })
          }
        }
      }

      // 如果没有批量调用，检查单个函数调用
      if (functionCalls.length === 0) {
        for (const key of supportedFunctionCallKeys) {
          if (jsonObj[key] && typeof jsonObj[key] === 'object' && jsonObj[key].name) {
            const call = jsonObj[key]
            functionCalls.push({
              name: call.name,
              arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
            })
          }
        }
      }

      // 如果顶层没有函数调用，但有嵌套对象，递归搜索
      if (functionCalls.length === 0 && typeof jsonObj === 'object' && jsonObj !== null && !Array.isArray(jsonObj)) {
        for (const key in jsonObj) {
          const value = jsonObj[key]
          if (typeof value === 'object' && value !== null) {
            // 检查嵌套对象是否包含批量函数调用
            if (value.function_calls && Array.isArray(value.function_calls)) {
              for (const call of value.function_calls) {
                if (call && typeof call === 'object' && call.name) {
                  functionCalls.push({
                    name: call.name,
                    arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                  })
                }
              }
            }

            // 检查嵌套对象是否包含单个函数调用
            if (functionCalls.length === 0) {
              for (const funcKey of supportedFunctionCallKeys) {
                if (value[funcKey] && typeof value[funcKey] === 'object' && value[funcKey].name) {
                  const call = value[funcKey]
                  functionCalls.push({
                    name: call.name,
                    arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                  })
                }
              }
            }
          }
        }
      }
    }
    catch {
      // 如果内容已经是对象，不需要进一步处理
      if (typeof content === 'object') {
        return functionCalls
      }

      // 不是有效的JSON，尝试使用正则表达式匹配代码块
      const jsonBlockRegex = /```(?:json)?([\s\S]*?)```/g
      let match

      const jsonMatches = contentStr.matchAll(jsonBlockRegex)
      for (match of jsonMatches) {
        try {
          const jsonContent = match[1].trim()
          const jsonObj = JSON.parse(jsonContent)

          // 检查JSON代码块中是否有批量函数调用
          if (jsonObj.function_calls && Array.isArray(jsonObj.function_calls)) {
            for (const call of jsonObj.function_calls) {
              if (call && typeof call === 'object' && call.name) {
                functionCalls.push({
                  name: call.name,
                  arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                })
              }
            }
          }

          // 如果没有批量调用，检查单个函数调用
          if (functionCalls.length === 0) {
            for (const key of supportedFunctionCallKeys) {
              if (jsonObj[key] && typeof jsonObj[key] === 'object' && jsonObj[key].name) {
                const call = jsonObj[key]
                functionCalls.push({
                  name: call.name,
                  arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                })
              }
            }
          }

          // 如果顶层没有函数调用，但有嵌套对象，递归检查一层
          if (functionCalls.length === 0 && typeof jsonObj === 'object' && jsonObj !== null && !Array.isArray(jsonObj)) {
            for (const key in jsonObj) {
              const value = jsonObj[key]
              if (typeof value === 'object' && value !== null) {
                // 检查嵌套对象是否包含批量函数调用
                if (value.function_calls && Array.isArray(value.function_calls)) {
                  for (const call of value.function_calls) {
                    if (call && typeof call === 'object' && call.name) {
                      functionCalls.push({
                        name: call.name,
                        arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                      })
                    }
                  }
                }

                // 检查嵌套对象是否包含单个函数调用
                if (functionCalls.length === 0) {
                  for (const funcKey of supportedFunctionCallKeys) {
                    if (value[funcKey] && typeof value[funcKey] === 'object' && value[funcKey].name) {
                      const call = value[funcKey]
                      functionCalls.push({
                        name: call.name,
                        arguments: typeof call.arguments === 'string' ? JSON.parse(call.arguments) : call.arguments,
                      })
                    }
                  }
                }
              }
            }
          }
        }
        catch {
          // 忽略解析错误
        }
      }
    }

    return functionCalls
  }

  /**
   * 执行函数调用
   * @param functionCalls 函数调用列表
   * @param callback 回调函数
   * @returns 带执行结果的函数调用列表
   */
  private async executeFunctionCalls(
    functionCalls: FunctionCall[],
    callback?: AgentCallback,
  ): Promise<FunctionCall[]> {
    const results: FunctionCall[] = []

    // 通知开始执行函数调用
    callback?.('function_call_start', { functionCalls })

    for (const call of functionCalls) {
      const func = this.functions.find(f => f.name === call.name)

      if (func) {
        try {
          // 复制函数调用对象，添加执行结果
          const resultCall = { ...call }

          // 执行函数
          resultCall.result = await func.executor(call.arguments)
          results.push(resultCall)
        }
        catch (error: any) {
          // 通知执行函数出错
          callback?.('error', {
            functionCall: call,
            error: error.message,
          })

          // 捕获执行错误，返回错误信息
          results.push({
            ...call,
            result: { error: error.message },
          })
        }
      }
      else {
        // 通知未找到函数
        callback?.('error', {
          functionCall: call,
          error: `Function '${call.name}' not found`,
        })

        // 未找到对应函数，返回错误信息
        results.push({
          ...call,
          result: { error: `Function '${call.name}' not found` },
        })
      }
    }

    // 通知函数调用结束
    callback?.('function_call_end', { functionCalls: results })

    return results
  }

  /**
   * 处理函数调用并生成最终响应
   * @param initialResponse 初始AI响应
   * @param depth 当前递归深度
   * @param callback 回调函数
   * @param options 聊天请求选项
   * @returns 最终响应（包含函数执行结果）
   */
  private async processFunctionCallsRecursively<T extends ChatOptions | undefined>(
    initialResponse: ChatResponse<any>,
    depth = 0,
    callback?: AgentCallback,
    options?: T,
  ): Promise<EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>> {
    if (depth === 0) {
      // 通知递归处理开始
      callback?.('recursion_start', {
        initialResponse,
        depth,
      })
    }

    // 解析并处理函数调用
    const functionCalls = this.parseFunctionCalls(initialResponse.content)

    // 如果没有函数调用或已达到最大递归深度，直接返回响应
    if (functionCalls.length === 0 || depth >= this.maxRecursionDepth) {
      const response = {
        ...initialResponse,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

      if (depth === 0 && options?.responseFormat === ResponseFormat.JSON && !initialResponse.isJsonResponse) {
        // 如果需要返回JSON但还未解析，在最终结果时解析
        try {
          const contentStr = typeof initialResponse.content === 'string'
            ? initialResponse.content
            : JSON.stringify(initialResponse.content)

          // 尝试解析JSON
          response.content = JSON.parse(contentStr)
          response.isJsonResponse = true
        }
        catch {
          // 解析失败，尝试修复
          try {
            const contentStr = typeof initialResponse.content === 'string'
              ? initialResponse.content
              : JSON.stringify(initialResponse.content)
            const repairedJson = this.repairJson(contentStr)
            response.content = JSON.parse(repairedJson)
            response.isJsonResponse = true
          }
          catch (e: any) {
            // 如果解析仍失败，保留原样
            console.error(`无法解析或修复JSON响应: ${e.message}`)
          }
        }
      }

      if (depth === 0) {
        // 通知递归处理结束
        callback?.('recursion_end', {
          response,
          depth,
          completedFunctionCalls: functionCalls,
        })
      }

      return response
    }

    // 执行函数调用
    const executedCalls = await this.executeFunctionCalls(functionCalls, callback)

    // 生成函数结果摘要
    const resultsSummary = executedCalls.map(call =>
      `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
    ).join('\n\n')

    // 获取初始响应的内容（如果是对象，转为字符串）
    const initialContent = typeof initialResponse.content === 'object'
      ? JSON.stringify(initialResponse.content, null, 2)
      : initialResponse.content as string

    // 构建新的提示，包含原始响应和函数执行结果
    const followupPrompt = `
My previous question was: ${initialResponse.additionalInfo?.userPrompt || ''}

Your response was:
${initialContent}

Here are the results of the function calls:
${resultsSummary}

Please generate a final response that incorporates all this information. If you need to call additional functions, please clearly indicate this.
${options?.responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`

    // 如果已达到最大递归深度但还有函数调用，则生成带有结果的最终回复
    if (depth >= this.maxRecursionDepth - 1 && functionCalls.length > 0) {
      const finalResponse = await this.baseModel.unifiedChat(followupPrompt, options)

      // 确保在递归结束时返回正确的格式
      const response = {
        ...finalResponse,
        functionCalls: executedCalls,
        additionalInfo: {
          ...initialResponse.additionalInfo,
          userPrompt: initialResponse.additionalInfo?.userPrompt,
        },
      } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

      if (depth === 0) {
        // 通知递归处理结束
        callback?.('recursion_end', {
          response,
          depth: depth + 1,
          completedFunctionCalls: executedCalls,
        })
      }

      return response
    }

    // 递归处理：将函数结果提供给模型，可能触发更多函数调用
    const followupResponse = await this.baseModel.unifiedChat(followupPrompt, options)

    // 获取后续响应中的函数调用
    const nextResponse = await this.processFunctionCallsRecursively(
      {
        ...followupResponse,
        additionalInfo: {
          ...initialResponse.additionalInfo,
          userPrompt: initialResponse.additionalInfo?.userPrompt,
        },
      },
      depth + 1,
      callback,
      options,
    )

    // 合并函数调用链
    const response = {
      ...nextResponse,
      functionCalls: [...executedCalls, ...(nextResponse.functionCalls || [])],
    } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

    if (depth === 0) {
      // 通知递归处理结束
      callback?.('recursion_end', {
        response,
        depth: this.maxRecursionDepth,
        completedFunctionCalls: [...executedCalls, ...(nextResponse.functionCalls || [])],
      })
    }

    return response
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
    // 通知开始响应
    callback?.('response_start', { prompt, options })

    try {
      // 增强提示，添加函数定义
      const enhancedPrompt = this.enhancePrompt(prompt)

      // 调用基础模型
      const response = await this.baseModel.unifiedChat(enhancedPrompt, options)

      // 保存原始用户提示
      const initialResponse = {
        ...response,
        additionalInfo: {
          ...response.additionalInfo,
          userPrompt: prompt,
        },
      }

      const finalResponse = await this.processFunctionCallsRecursively(initialResponse, 0, callback, options) as unknown as ResponseTypeForOptions<T>

      // 确保在JSON模式下返回解析后的JSON对象
      if (options?.responseFormat === ResponseFormat.JSON && !finalResponse.isJsonResponse) {
        // 如果需要返回JSON但还未解析，在最终结果时解析
        const contentStr = typeof finalResponse.content === 'string'
          ? finalResponse.content
          : JSON.stringify(finalResponse.content)

        try {
          // 尝试解析JSON
          (finalResponse as any).content = JSON.parse(contentStr)
          finalResponse.isJsonResponse = true as any
        }
        catch {
          // 解析失败，尝试修复
          try {
            const repairedJson = this.repairJson(contentStr)
            ;(finalResponse as any).content = JSON.parse(repairedJson)
            finalResponse.isJsonResponse = true as any
          }
          catch (e: any) {
            // 如果解析仍失败，保留原样并记录错误
            console.error(`无法解析或修复JSON响应: ${e.message}`)
          }
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
      // 增强提示，添加函数定义
      const enhancedPrompt = this.enhancePrompt(prompt)

      // 流式获取响应
      let fullContent = ''
      let lastChunk = {
        content: '',
        isLast: false,
        model: this.getModel(),
        isJsonResponse: false,
      } as StreamChunkTypeForOptions<T>

      // 记录所有函数调用
      const allFunctionCalls: FunctionCall[] = []

      // 处理流式响应
      for await (const chunk of this.baseModel.unifiedChatStream(enhancedPrompt, options)) {
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
      const functionCalls = this.parseFunctionCalls(fullContent)

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
        while (currentDepth < this.maxRecursionDepth) {
          // 解析当前响应中的函数调用
          const currentCalls = this.parseFunctionCalls(currentResponse.content)
          if (currentCalls.length === 0) {
            break
          }

          // 执行函数调用
          const executedCalls = await this.executeFunctionCalls(currentCalls, callback)

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
          const followupPrompt = `
My previous question was: ${prompt}

Your response was:
${currentResponseContent}

Here are the results of the function calls:
${resultsSummary}

Please generate a final response that incorporates all this information. If you need to call additional functions, please clearly indicate this.
${options?.responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`

          // 获取包含函数结果的后续响应
          const followupResponse = await this.baseModel.unifiedChat(followupPrompt, options)

          // 更新当前响应和递归深度
          currentResponse = followupResponse
          currentDepth++

          // 如果已达到最大递归深度或没有新的函数调用，输出最终结果
          if (currentDepth >= this.maxRecursionDepth || this.parseFunctionCalls(followupResponse.content).length === 0) {
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
                finalContent = JSON.parse(contentStr)
                isJsonResponse = true
              }
              catch {
                // 解析失败，尝试修复
                try {
                  const repairedJson = this.repairJson(contentStr)
                  finalContent = JSON.parse(repairedJson)
                  isJsonResponse = true
                }
                catch (e: any) {
                  // 如果解析仍失败，保留原样
                  finalContent = `\n\nFinal result (JSON parsing failed):\n${contentStr}`
                  console.error(`无法解析或修复JSON响应: ${e.message}`)
                }
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
          const jsonContent = JSON.parse(fullContent)
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
            const repairedJson = this.repairJson(fullContent)
            const jsonContent = JSON.parse(repairedJson)

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
