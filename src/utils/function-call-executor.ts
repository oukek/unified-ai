import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { AgentCallback, AgentFunction, FunctionCall } from '../types'

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
    functions: AgentFunction[],
    callback?: AgentCallback,
    mcpClient?: Client,
  ): Promise<FunctionCall[]> {
    const results: FunctionCall[] = []

    // 通知开始执行函数调用
    callback?.('function_call_start', { functionCalls })

    for (const call of functionCalls) {
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
}
