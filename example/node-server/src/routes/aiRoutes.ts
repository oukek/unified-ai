import type { Request, Response, Router } from 'express'
import { aiService } from '../services/aiService'
import { configService } from '../services/configService'

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
