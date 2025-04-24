import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { BaseModel } from '../base'
import type {
  AgentCallback,
  ChatOptions,
  ChatResponse,
  EnhancedChatResponse,
} from '../types'
import { AgentEventType, ResponseFormat } from '../types'
import { FunctionCallExecutor } from './function-call-executor'
import { FunctionCallParser } from './function-call-parser'
import { JsonHelper } from './json-helper'
import { ModelHelpers } from './model-helpers'

/**
 * 函数调用处理器配置选项
 */
export interface FunctionCallProcessorOptions {
  /** 最大递归深度 */
  maxRecursionDepth?: number
}

/**
 * 函数调用处理器
 * 负责处理函数调用链和递归执行
 */
export class FunctionCallProcessor {
  /** 最大递归深度 */
  public readonly maxRecursionDepth: number

  /**
   * 构造函数
   * @param options 配置选项
   */
  constructor(options: FunctionCallProcessorOptions = {}) {
    this.maxRecursionDepth = options.maxRecursionDepth ?? 25
  }

  /**
   * 处理函数调用并生成最终响应
   * @param baseModel 基础AI模型
   * @param initialResponse 初始AI响应
   * @param functions 可用的函数列表
   * @param depth 当前递归深度
   * @param callback 回调函数
   * @param options 聊天请求选项
   * @returns 最终响应（包含函数执行结果）
   */
  async processFunctionCallsRecursively<T extends ChatOptions | undefined>(
    baseModel: BaseModel,
    initialResponse: ChatResponse<any>,
    functions: any[],
    depth = 0,
    callback?: AgentCallback,
    options?: T,
    mcpClient?: Client,
  ): Promise<EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>> {
    if (depth === 0) {
      // 通知递归处理开始
      callback?.(AgentEventType.RECURSION_START, {
        initialResponse,
        depth,
        initialContent: initialResponse.content,
        functionCalls: [],
      })
    }

    // 解析并处理函数调用
    const functionCalls = FunctionCallParser.parseFunctionCalls(initialResponse.content)

    // 如果没有函数调用或已达到最大递归深度，直接返回响应
    if (functionCalls.length === 0 || depth >= this.maxRecursionDepth) {
      const response = {
        ...initialResponse,
        functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
      } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

      // 从响应中移除函数调用标签
      if (typeof response.content === 'string') {
        response.content = FunctionCallParser.removeTaggedFunctionCalls(response.content) as any
      }

      if (depth === 0 && options?.responseFormat === ResponseFormat.JSON && !initialResponse.isJsonResponse) {
        // 如果需要返回JSON但还未解析，在最终结果时解析
        try {
          const contentStr = typeof initialResponse.content === 'string'
            ? FunctionCallParser.removeTaggedFunctionCalls(initialResponse.content)
            : JSON.stringify(initialResponse.content)

          // 尝试解析JSON
          response.content = JsonHelper.safeParseJson(contentStr)
          response.isJsonResponse = true
        }
        catch {
          // 解析失败，尝试修复
          try {
            const contentStr = typeof initialResponse.content === 'string'
              ? FunctionCallParser.removeTaggedFunctionCalls(initialResponse.content)
              : JSON.stringify(initialResponse.content)
            response.content = JsonHelper.safeParseJson(contentStr)
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
        callback?.(AgentEventType.RECURSION_END, {
          response,
          depth,
          completedFunctionCalls: functionCalls,
          finalContent: response.content,
          functionCalls,
        })
      }

      return response
    }

    // 执行函数调用
    const executedCalls = await FunctionCallExecutor.executeFunctionCalls(functionCalls, functions, callback, mcpClient)

    // 生成函数结果摘要
    const resultsSummary = executedCalls.map(call =>
      `Function: ${call.name}\nParameters: ${JSON.stringify(call.arguments)}\nResult: ${JSON.stringify(call.result)}`,
    ).join('\n\n')

    // 获取初始响应的内容（如果是对象，转为字符串）
    const initialContent = typeof initialResponse.content === 'object'
      ? JSON.stringify(initialResponse.content, null, 2)
      : initialResponse.content as string

    // 构建新的提示，包含原始响应和函数执行结果
    let followupPrompt = `
My previous question was: ${initialResponse.additionalInfo?.userPrompt || ''}

Your response was:
${initialContent}

Here are the results of the function calls:
${resultsSummary}

Please generate a final response that incorporates all this information. 
If you need to call additional functions, please clearly indicate this.
If you still need to continue using the tool, please continue to use it instead of directly generating the final result.
${options?.responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`
// 如果模型不支持工具，使用提示增强
    if (!baseModel.supportsTools(baseModel.getModel(options?.model)) && functions.length > 0) {
      followupPrompt = ModelHelpers.enhanceContentWithTools(followupPrompt, functions)
    }

    // 如果已达到最大递归深度但还有函数调用，则生成带有结果的最终回复
    if (depth >= this.maxRecursionDepth - 1 && functionCalls.length > 0) {
      const finalResponse = await baseModel.unifiedChat(followupPrompt, options)

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
        callback?.(AgentEventType.RECURSION_END, {
          response,
          depth: depth + 1,
          completedFunctionCalls: executedCalls,
          finalContent: response.content,
          functionCalls: executedCalls,
        })
      }

      return response
    }

    // 递归处理：将函数结果提供给模型，可能触发更多函数调用
    const followupResponse = await baseModel.unifiedChat(followupPrompt, options)

    // 检查followupResponse中是否有新的函数调用
    const newFunctionCalls = FunctionCallParser.parseFunctionCalls(followupResponse.content)

    // 如果没有新的函数调用，直接返回结果
    if (newFunctionCalls.length === 0) {
      const response = {
        ...followupResponse,
        functionCalls: executedCalls,
        additionalInfo: {
          ...initialResponse.additionalInfo,
          userPrompt: initialResponse.additionalInfo?.userPrompt,
        },
      } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

      if (depth === 0) {
        // 通知递归处理结束
        callback?.(AgentEventType.RECURSION_END, {
          response,
          depth: depth + 1,
          completedFunctionCalls: executedCalls,
          finalContent: response.content,
          functionCalls: executedCalls,
        })
      }

      return response
    }

    // 获取后续响应中的函数调用
    const nextResponse = await this.processFunctionCallsRecursively(
      baseModel,
      {
        ...followupResponse,
        additionalInfo: {
          ...initialResponse.additionalInfo,
          userPrompt: initialResponse.additionalInfo?.userPrompt,
        },
      },
      functions,
      depth + 1,
      callback,
      options,
      mcpClient,
    )

    // 合并函数调用链
    const response = {
      ...nextResponse,
      functionCalls: [...executedCalls, ...(nextResponse.functionCalls || [])],
    } as EnhancedChatResponse<T extends { responseFormat: ResponseFormat.JSON } ? ResponseFormat.JSON : ResponseFormat.TEXT>

    if (depth === 0) {
      // 通知递归处理结束
      callback?.(AgentEventType.RECURSION_END, {
        response,
        depth: this.maxRecursionDepth,
        completedFunctionCalls: [...executedCalls, ...(nextResponse.functionCalls || [])],
        finalContent: response.content,
        functionCalls: [...executedCalls, ...(nextResponse.functionCalls || [])],
      })
    }

    return response
  }
}
