import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { AgentCallback, AgentFunctionSchema, FunctionCall } from '../types'
import { AgentEventType } from '../types'

/**
 * 函数调用执行器
 * 负责执行函数调用并返回结果
 */
export class FunctionCallExecutor {
  /**
   * 执行函数调用
   * @param functionCalls 函数调用列表
   * @param functions 可用的函数列表
   * @param callback 回调函数
   * @returns 带执行结果的函数调用列表
   */
  static async executeFunctionCalls(
    functionCalls: FunctionCall[],
    functions: AgentFunctionSchema[],
    callback?: AgentCallback,
    mcpClient?: Client,
  ): Promise<FunctionCall[]> {
    const results: FunctionCall[] = []

    if (!functionCalls || functionCalls.length === 0) {
      return results
    }

    // 确保每个函数调用都有唯一ID
    functionCalls.forEach((call, index) => {
      if (!call.id) {
        // 如果没有ID，生成一个唯一ID
        call.id = `func_call_${Date.now()}_${index}`
      }
    })

    // 通知开始执行函数调用
    callback?.(AgentEventType.FUNCTION_CALL_START, { functionCalls })

    for (const call of functionCalls) {
      // 检查函数调用是否已经执行
      if (call.result !== undefined) {
        // 已执行过的函数调用直接添加到结果中
        results.push(call)
        continue
      }

      const func = functions.find(f => f.name === call.name)

      if (func) {
        try {
          // 复制函数调用对象，添加执行结果
          const resultCall = { ...call }

          if (func.executor) {
            // 执行函数
            resultCall.result = await func.executor(call.arguments)
          }
          else {
            // 执行函数
            resultCall.result = await mcpClient?.callTool({
              name: func.name,
              arguments: call.arguments,
            })
          }
          results.push(resultCall)
        }
        catch (error: any) {
          // 通知执行函数出错
          callback?.(AgentEventType.ERROR, {
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
        callback?.(AgentEventType.ERROR, {
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
    callback?.(AgentEventType.FUNCTION_CALL_END, { functionCalls: results })

    return results
  }
}
