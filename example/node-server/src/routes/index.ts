import express from 'express'
import { registerAiRoutes } from './aiRoutes'

// 创建路由实例
const router = express.Router()

// 注册AI相关路由
registerAiRoutes(router)

// 基础路由
router.get('/', (req, res) => {
  res.json({ message: '欢迎使用UnifiedAI API服务' })
})

export default router
