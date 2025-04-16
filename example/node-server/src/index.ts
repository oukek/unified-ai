import type { Request, Response } from 'express'
import http from 'node:http'
import path from 'node:path'
import * as process from 'node:process'
import * as dotenv from 'dotenv'
import express from 'express'
import apiRoutes from './routes'
import { aiService } from './services/aiService'
import { aiSocketService } from './services/aiSocketService'
import { socketService } from './services/socketService'

// 加载环境变量
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// 创建 HTTP 服务器
const server = http.createServer(app)

// 初始化 Socket.IO 服务
socketService.initialize(server)

// 初始化 AI Socket 服务
aiSocketService.initialize(socketService.getIoInstance())

// 初始化 AI 服务
aiService.initialize()

// 中间件
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// CORS 中间件
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200)
  }
  next()
})

// API 路由
app.use('/api', apiRoutes)

// 基础路由
app.get('/', (req: Request, res: Response) => {
  res.json({ message: '欢迎使用 UnifiedAI API 服务器' })
})

// 启动服务器
server.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`)
  console.log(`Socket.IO 服务可访问：http://localhost:${port}`)
})
