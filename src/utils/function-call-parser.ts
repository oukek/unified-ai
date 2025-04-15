import type { FunctionCall } from '../types'
import { JsonHelper } from './json-helper'

/**
 * 函数调用解析器
 * 用于从AI响应中提取函数调用
 */
export class FunctionCallParser {
  /**
   * 解析AI响应中的函数调用
   * @param content AI响应内容，可以是字符串或对象
   * @returns 解析出的函数调用列表
   */
  static parseFunctionCalls(content: string | Record<string, any>): FunctionCall[] {
    // 如果内容是对象，先转为字符串
    const contentStr = typeof content === 'object' ? JSON.stringify(content) : content as string

    // 查找可能的函数调用格式，支持多种常见格式
    const functionCalls: FunctionCall[] = []

    // 尝试解析JSON并提取函数调用
    try {
      // 检查内容是否为完整JSON
      const jsonObj = typeof content === 'object' ? content : JsonHelper.safeParseJson(contentStr)

      // 首先检查是否有批量函数调用
      if (jsonObj.function_calls && Array.isArray(jsonObj.function_calls)) {
        this.extractBatchFunctionCalls(jsonObj.function_calls, functionCalls)
      }

      // 如果顶层没有函数调用，但有嵌套对象，递归搜索
      if (functionCalls.length === 0 && typeof jsonObj === 'object' && jsonObj !== null && !Array.isArray(jsonObj)) {
        this.extractNestedFunctionCalls(jsonObj, functionCalls)
      }

      if (functionCalls.length === 0) {
        // 尝试使用正则表达式匹配代码块
        this.extractFunctionCallsFromCodeBlocks(contentStr, functionCalls)
      }
    }
    catch (e: any) {
      console.error(e)
      // 如果内容已经是对象，不需要进一步处理
      if (typeof content === 'object') {
        return functionCalls
      }

      // 不是有效的JSON，尝试使用正则表达式匹配代码块
      this.extractFunctionCallsFromCodeBlocks(contentStr, functionCalls)
    }

    return functionCalls
  }

  /**
   * 从批量函数调用中提取函数调用
   * @param calls 批量函数调用数组
   * @param functionCalls 存储提取结果的数组
   */
  private static extractBatchFunctionCalls(calls: any[], functionCalls: FunctionCall[]): void {
    for (const call of calls) {
      if (call && typeof call === 'object' && call.name) {
        functionCalls.push({
          name: call.name,
          arguments: typeof call.arguments === 'string' ? JsonHelper.safeParseJson(call.arguments) : call.arguments,
        })
      }
    }
  }

  /**
   * 从嵌套对象中提取函数调用
   * @param obj 嵌套对象
   * @param functionCalls 存储提取结果的数组
   */
  private static extractNestedFunctionCalls(obj: any, functionCalls: FunctionCall[]): void {
    for (const key in obj) {
      const value = obj[key]
      if (typeof value === 'object' && value !== null) {
        // 检查嵌套对象是否包含批量函数调用
        if (value.function_calls && Array.isArray(value.function_calls)) {
          this.extractBatchFunctionCalls(value.function_calls, functionCalls)
        }
      }
    }
  }

  /**
   * 从代码块中提取函数调用
   * @param content 包含代码块的内容
   * @param functionCalls 存储提取结果的数组
   */
  private static extractFunctionCallsFromCodeBlocks(content: string, functionCalls: FunctionCall[]): void {
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/g
    const jsonMatches = content.matchAll(jsonBlockRegex)

    for (const match of jsonMatches) {
      try {
        const jsonContent = match[1].trim()
        const jsonObj = JsonHelper.safeParseJson(jsonContent)

        // 检查JSON代码块中是否有批量函数调用
        if (jsonObj.function_calls && Array.isArray(jsonObj.function_calls)) {
          this.extractBatchFunctionCalls(jsonObj.function_calls, functionCalls)
        }

        // 如果顶层没有函数调用，但有嵌套对象，递归检查一层
        if (functionCalls.length === 0 && typeof jsonObj === 'object' && jsonObj !== null && !Array.isArray(jsonObj)) {
          this.extractNestedFunctionCalls(jsonObj, functionCalls)
        }
      }
      catch (e: any) {
        console.error(e)
        // 忽略解析错误
      }
    }
  }
}
