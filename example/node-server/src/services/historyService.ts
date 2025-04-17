import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import zlib from 'node:zlib'

// Promise-based versions of zlib functions
const gzipAsync = promisify(zlib.gzip)
const gunzipAsync = promisify(zlib.gunzip)

// Base directory for storing chat history
const HISTORY_DIR = path.join(process.cwd(), '__temp__', 'history')

// Maximum number of conversations to keep in the list
const MAX_HISTORY_ITEMS = 100

// Types for history management
export interface ChatHistorySummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  messageCount: number
  preview: string
}

export interface ChatHistoryDetail {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  model: string
  systemMessage?: string
  messages: ChatHistoryMessage[]
}

export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  functionCalls?: any[]
  functionResults?: any[]
}

/**
 * Chat历史记录服务
 */
class HistoryService {
  constructor() {
    this.ensureDirectoryExists()
  }

  /**
   * 确保历史记录目录存在
   */
  private ensureDirectoryExists(): void {
    try {
      if (!fs.existsSync(HISTORY_DIR)) {
        fs.mkdirSync(HISTORY_DIR, { recursive: true })
      }
    }
    catch (error) {
      console.error('创建历史记录目录失败:', error)
    }
  }

  /**
   * 获取历史记录列表文件路径
   */
  private getHistoryListPath(): string {
    return path.join(HISTORY_DIR, 'history_list.json.gz')
  }

  /**
   * 获取历史记录详情文件路径
   */
  private getHistoryDetailPath(id: string): string {
    return path.join(HISTORY_DIR, `history_${id}.json.gz`)
  }

  /**
   * 读取压缩的JSON文件
   */
  private async readCompressedJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      if (!fs.existsSync(filePath))
        return defaultValue

      const compressed = fs.readFileSync(filePath)
      const buffer = await gunzipAsync(compressed)
      return JSON.parse(buffer.toString()) as T
    }
    catch (error) {
      console.error(`读取文件失败 ${filePath}:`, error)
      return defaultValue
    }
  }

  /**
   * 写入并压缩JSON文件
   */
  private async writeCompressedJson(filePath: string, data: any): Promise<boolean> {
    try {
      const jsonStr = JSON.stringify(data)
      const compressed = await gzipAsync(Buffer.from(jsonStr))
      fs.writeFileSync(filePath, compressed)
      return true
    }
    catch (error) {
      console.error(`写入文件失败 ${filePath}:`, error)
      return false
    }
  }

  /**
   * 获取历史记录列表
   */
  async getHistoryList(): Promise<ChatHistorySummary[]> {
    return this.readCompressedJson<ChatHistorySummary[]>(this.getHistoryListPath(), [])
  }

  /**
   * 获取历史记录详情
   */
  async getHistoryDetail(id: string): Promise<ChatHistoryDetail | null> {
    const filePath = this.getHistoryDetailPath(id)

    if (!fs.existsSync(filePath))
      return null

    return this.readCompressedJson<ChatHistoryDetail | null>(filePath, null)
  }

  /**
   * 创建新的聊天记录
   */
  async createHistory(data: {
    title: string
    model: string
    systemMessage?: string
    initialMessage?: string
  }): Promise<string> {
    const id = Date.now().toString()
    const timestamp = Date.now()

    const historyDetail: ChatHistoryDetail = {
      id,
      title: data.title || '新对话',
      createdAt: timestamp,
      updatedAt: timestamp,
      model: data.model,
      systemMessage: data.systemMessage,
      messages: [],
    }

    // 如果有初始消息，添加到消息列表
    if (data.initialMessage) {
      historyDetail.messages.push({
        id: `${id}_0`,
        role: 'user',
        content: data.initialMessage,
        timestamp,
      })
    }

    // 保存详情
    await this.writeCompressedJson(this.getHistoryDetailPath(id), historyDetail)

    // 更新列表
    await this.updateHistoryList(historyDetail)

    return id
  }

  /**
   * 添加消息到历史记录
   */
  async addMessageToHistory(
    historyId: string,
    message: Omit<ChatHistoryMessage, 'id'>,
  ): Promise<boolean> {
    const historyDetail = await this.getHistoryDetail(historyId)

    if (!historyDetail)
      return false

    const messageId = `${historyId}_${historyDetail.messages.length}`

    historyDetail.messages.push({
      ...message,
      id: messageId,
    })

    historyDetail.updatedAt = Date.now()

    // 保存详情
    const success = await this.writeCompressedJson(
      this.getHistoryDetailPath(historyId),
      historyDetail,
    )

    if (success) {
      // 更新列表
      await this.updateHistoryList(historyDetail)
    }

    return success
  }

  /**
   * 更新历史记录
   * @param historyDetail 历史记录详情
   * @returns 是否更新成功
   */
  async updateHistory(historyDetail: ChatHistoryDetail): Promise<boolean> {
    if (!historyDetail || !historyDetail.id) {
      return false
    }

    // 更新更新时间
    historyDetail.updatedAt = Date.now()

    // 保存详情
    const success = await this.writeCompressedJson(
      this.getHistoryDetailPath(historyDetail.id),
      historyDetail,
    )

    if (success) {
      // 更新列表
      await this.updateHistoryList(historyDetail)
    }

    return success
  }

  /**
   * 更新历史记录列表
   */
  private async updateHistoryList(historyDetail: ChatHistoryDetail): Promise<void> {
    const list = await this.getHistoryList()

    // 查找是否已存在
    const existingIndex = list.findIndex(item => item.id === historyDetail.id)

    // 获取预览内容：如果有消息，使用第一条消息内容作为预览
    const preview = historyDetail.messages.length > 0
      ? historyDetail.messages[0].content.substring(0, 100)
      : historyDetail.title || '新对话'

    // 创建摘要
    const summary: ChatHistorySummary = {
      id: historyDetail.id,
      title: historyDetail.title,
      createdAt: historyDetail.createdAt,
      updatedAt: historyDetail.updatedAt,
      model: historyDetail.model,
      messageCount: historyDetail.messages.length,
      preview,
    }

    if (existingIndex >= 0) {
      // 更新现有记录
      list[existingIndex] = summary
    }
    else {
      // 添加新记录，保持最新的记录在前面
      list.unshift(summary)

      // 限制最大数量
      if (list.length > MAX_HISTORY_ITEMS)
        list.pop()
    }

    // 按更新时间排序
    list.sort((a, b) => b.updatedAt - a.updatedAt)

    await this.writeCompressedJson(this.getHistoryListPath(), list)
  }

  /**
   * 删除历史记录
   */
  async deleteHistory(id: string): Promise<boolean> {
    try {
      const detailPath = this.getHistoryDetailPath(id)

      if (fs.existsSync(detailPath))
        fs.unlinkSync(detailPath)

      // 更新列表
      const list = await this.getHistoryList()
      const newList = list.filter(item => item.id !== id)
      await this.writeCompressedJson(this.getHistoryListPath(), newList)

      return true
    }
    catch (error) {
      console.error(`删除历史记录失败 ${id}:`, error)
      return false
    }
  }

  /**
   * 清空所有历史记录
   */
  async clearAllHistory(): Promise<boolean> {
    try {
      const files = fs.readdirSync(HISTORY_DIR)

      for (const file of files) {
        fs.unlinkSync(path.join(HISTORY_DIR, file))
      }

      return true
    }
    catch (error) {
      console.error('清空历史记录失败:', error)
      return false
    }
  }
}

// 导出单例
export const historyService = new HistoryService()
