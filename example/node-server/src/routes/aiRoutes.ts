import type { Request, Response, Router } from 'express'
import { aiService } from '../services/aiService'
import { configService } from '../services/configService'
import { historyService } from '../services/historyService'

/**
 * 注册AI相关路由
 */
export function registerAiRoutes(router: Router): void {
  // 获取模型列表
  router.get('/ai/models', getModels)

  // 设置API密钥
  router.post('/ai/settings/apikey', setApiKey)

  // 获取API密钥设置状态
  router.get('/ai/settings/apikey/status', getApiKeyStatus)

  // 历史记录相关路由
  router.get('/ai/history', getHistoryList)
  router.get('/ai/history/:id', getHistoryDetail)
  router.post('/ai/history', createHistory)
  router.delete('/ai/history/:id', deleteHistory)
  router.delete('/ai/history', clearAllHistory)

  // 更新历史记录系统消息
  router.patch('/ai/history/:id/system', updateSystemMessage)
}

/**
 * 获取可用的AI模型列表
 */
function getModels(req: Request, res: Response): void {
  const models = aiService.getAvailableModels()
  res.json({
    success: true,
    models,
  })
}

/**
 * 设置API密钥
 */
function setApiKey(req: Request, res: Response): void {
  const { apiKey } = req.body

  if (!apiKey) {
    res.status(400).json({
      success: false,
      error: '缺少API密钥',
    })
    return
  }

  configService.setGeminiApiKey(apiKey)

  res.json({
    success: true,
    message: 'API密钥已设置',
  })
}

/**
 * 获取API密钥设置状态
 */
function getApiKeyStatus(req: Request, res: Response): void {
  const apiKey = configService.getGeminiApiKey()

  res.json({
    success: true,
    isSet: !!apiKey,
  })
}

/**
 * 获取历史记录列表
 */
async function getHistoryList(req: Request, res: Response): Promise<void> {
  try {
    const list = await historyService.getHistoryList()
    res.json({
      success: true,
      list,
    })
  }
  catch (error) {
    console.error('获取历史记录列表失败:', error)
    res.status(500).json({
      success: false,
      error: '获取历史记录列表失败',
    })
  }
}

/**
 * 获取历史记录详情
 */
async function getHistoryDetail(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  try {
    const detail = await historyService.getHistoryDetail(id)

    if (!detail) {
      res.status(404).json({
        success: false,
        error: '历史记录不存在',
      })
      return
    }

    res.json({
      success: true,
      detail,
    })
  }
  catch (error) {
    console.error('获取历史记录详情失败:', error)
    res.status(500).json({
      success: false,
      error: '获取历史记录详情失败',
    })
  }
}

/**
 * 创建历史记录
 */
async function createHistory(req: Request, res: Response): Promise<void> {
  const { title, model, systemMessage, initialMessage } = req.body

  if (!title || !model) {
    res.status(400).json({
      success: false,
      error: '缺少必要参数',
    })
    return
  }

  try {
    const historyId = await aiService.createChatHistory({
      title,
      model,
      systemMessage,
      initialMessage,
    })

    res.json({
      success: true,
      historyId,
    })
  }
  catch (error) {
    console.error('创建历史记录失败:', error)
    res.status(500).json({
      success: false,
      error: '创建历史记录失败',
    })
  }
}

/**
 * 删除历史记录
 */
async function deleteHistory(req: Request, res: Response): Promise<void> {
  const { id } = req.params

  try {
    const success = await historyService.deleteHistory(id)

    if (!success) {
      res.status(404).json({
        success: false,
        error: '历史记录不存在或删除失败',
      })
      return
    }

    res.json({
      success: true,
      message: '历史记录已删除',
    })
  }
  catch (error) {
    console.error('删除历史记录失败:', error)
    res.status(500).json({
      success: false,
      error: '删除历史记录失败',
    })
  }
}

/**
 * 清空所有历史记录
 */
async function clearAllHistory(req: Request, res: Response): Promise<void> {
  try {
    const success = await historyService.clearAllHistory()

    if (!success) {
      res.status(500).json({
        success: false,
        error: '清空历史记录失败',
      })
      return
    }

    res.json({
      success: true,
      message: '所有历史记录已清空',
    })
  }
  catch (error) {
    console.error('清空历史记录失败:', error)
    res.status(500).json({
      success: false,
      error: '清空历史记录失败',
    })
  }
}

/**
 * 更新历史记录的系统消息
 */
async function updateSystemMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params
  const { systemMessage } = req.body

  if (systemMessage === undefined) {
    res.status(400).json({
      success: false,
      error: '缺少系统消息内容',
    })
    return
  }

  try {
    const detail = await historyService.getHistoryDetail(id)

    if (!detail) {
      res.status(404).json({
        success: false,
        error: '历史记录不存在',
      })
      return
    }

    // 更新系统消息
    detail.systemMessage = systemMessage
    detail.updatedAt = Date.now()

    // 保存更新
    const success = await historyService.updateHistory(detail)

    if (success) {
      res.json({
        success: true,
        message: '系统消息已更新',
      })
    }
    else {
      res.status(500).json({
        success: false,
        error: '更新系统消息失败',
      })
    }
  }
  catch (error) {
    console.error('更新系统消息失败:', error)
    res.status(500).json({
      success: false,
      error: '更新系统消息失败',
    })
  }
}
