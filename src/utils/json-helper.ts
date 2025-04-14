/**
 * JSON 处理工具类
 * 用于处理 JSON 解析和修复相关操作
 */
import { jsonrepair } from 'jsonrepair'

export class JsonHelper {
  /**
   * 尝试修复格式不正确的 JSON 字符串
   * @param jsonStr 可能格式不正确的 JSON 字符串
   * @returns 修复后的 JSON 字符串
   */
  static repairJson(jsonStr: string): string {
    if (!jsonStr || typeof jsonStr !== 'string') {
      return '{}'
    }

    try {
      // 尝试解析，如果成功，直接返回原字符串
      JSON.parse(jsonStr)
      return jsonStr
    }
    catch {
      try {
        // 使用 jsonrepair 库进行修复
        return jsonrepair(jsonStr)
      }
      catch {
        // 如果仍然无法修复，返回空对象
        return '{}'
      }
    }
  }

  /**
   * 安全解析 JSON 字符串
   * 如果解析失败，会尝试修复并再次解析
   * @param content 要解析的内容
   * @returns 解析后的对象或默认值
   */
  static safeParseJson(content: string | Record<string, any>): any {
    // 如果已经是对象，直接返回
    if (typeof content !== 'string') {
      return content
    }

    try {
      // 尝试解析
      return JSON.parse(content)
    }
    catch {
      try {
        // 尝试修复并再次解析
        const repaired = this.repairJson(content)
        return JSON.parse(repaired)
      }
      catch {
        // 如果仍然失败，返回空对象
        return {}
      }
    }
  }
}
