import type { Server } from 'socket.io'
import type { CallbackState } from './aiService'
import { aiService } from './aiService'

/**
 * AI Socket服务 - 处理流式响应
 */
class AiSocketService {
  private io: Server | null = null

  /**
   * 初始化Socket服务
   */
  initialize(io: Server): void {
    this.io = io
    this.setupSocketHandlers()
    console.log('AI Socket服务已初始化')
  }

  /**
   * 设置Socket事件处理
   */
  private setupSocketHandlers(): void {
    if (!this.io)
      return

    this.io.on('connection', (socket) => {
      console.log(`用户已连接AI服务: ${socket.id}`)

      // 处理流式聊天请求
      socket.on('ai:chat-stream', async (data) => {
        const { prompt, model } = data

        if (!prompt) {
          socket.emit('ai:error', { message: '缺少聊天内容', timestamp: Date.now() })
          return
        }

        try {
          socket.emit('ai:start', { message: '开始生成回复...', timestamp: Date.now() })

          // 定义回调函数处理各种状态
          const callback = (state: CallbackState, data: any) => {
            const timestamp = Date.now()

            switch (state) {
              case 'response_start':
                socket.emit('ai:response_start', {
                  prompt: data.prompt,
                  timestamp,
                })
                break

              case 'function_call_start':
                socket.emit('ai:function_call_start', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                  })),
                  timestamp,
                })
                break

              case 'function_call_end':
                socket.emit('ai:function_call_end', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                    result: f.result,
                  })),
                  timestamp,
                })
                break

              case 'response_chunk':
                // 流式响应的每个块由下面的for循环处理
                break

              case 'response_end':
                // 流式响应的结束由下面的for循环处理
                break

              case 'error':
                socket.emit('ai:error', {
                  message: data.error.message || '处理请求时出错',
                  timestamp,
                })
                break
            }
          }

          const generator = aiService.chatStream(prompt, { model, callback })
          let isCompleted = false

          if (!generator) {
            socket.emit('ai:error', { message: 'AI服务未初始化', timestamp: Date.now() })
            return
          }

          for await (const chunk of generator) {
            if (!chunk) {
              socket.emit('ai:error', { message: '生成回复失败', timestamp: Date.now() })
              break
            }

            socket.emit('ai:chunk', {
              content: chunk.content,
              isLast: chunk.isLast,
              model: chunk.model,
              timestamp: Date.now(),
            })

            if (chunk.isLast) {
              isCompleted = true
              socket.emit('ai:end', {
                message: '生成完成',
                model: chunk.model,
                timestamp: Date.now(),
              })
            }
          }

          if (!isCompleted) {
            socket.emit('ai:end', { message: '生成完成', timestamp: Date.now() })
          }
        }
        catch (error) {
          console.error('处理流式聊天请求失败:', error)
          socket.emit('ai:error', { message: '处理流式聊天请求失败', timestamp: Date.now() })
        }
      })

      // 普通聊天请求（带实时状态回调）
      socket.on('ai:chat', async (data) => {
        const { prompt, model } = data

        if (!prompt) {
          socket.emit('ai:error', { message: '缺少聊天内容', timestamp: Date.now() })
          return
        }

        try {
          socket.emit('ai:start', { message: '开始生成回复...', timestamp: Date.now() })

          // 定义回调函数处理各种状态
          const callback = (state: CallbackState, data: any) => {
            const timestamp = Date.now()

            switch (state) {
              case 'response_start':
                socket.emit('ai:response_start', {
                  prompt: data.prompt,
                  timestamp,
                })
                break

              case 'function_call_start':
                socket.emit('ai:function_call_start', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                  })),
                  timestamp,
                })
                break

              case 'function_call_end':
                socket.emit('ai:function_call_end', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                    result: f.result,
                  })),
                  timestamp,
                })
                break

              case 'response_chunk':
                // 非流式聊天不处理这个状态
                break

              case 'response_end':
                // 最终响应由下面的代码处理
                break

              case 'error':
                socket.emit('ai:error', {
                  message: data.error.message || '处理请求时出错',
                  timestamp,
                })
                break
            }
          }

          const response = await aiService.chat(prompt, { model, callback })

          if (!response) {
            socket.emit('ai:error', { message: 'AI服务未初始化或请求失败', timestamp: Date.now() })
            return
          }

          socket.emit('ai:response', {
            content: response.content,
            model: response.model,
            functionCalls: response.functionCalls || [],
            timestamp: Date.now(),
          })

          socket.emit('ai:end', {
            message: '生成完成',
            model: response.model,
            timestamp: Date.now(),
          })
        }
        catch (error) {
          console.error('处理聊天请求失败:', error)
          socket.emit('ai:error', { message: '处理聊天请求失败', timestamp: Date.now() })
        }
      })

      socket.on('disconnect', () => {
        console.log(`用户已断开AI服务连接: ${socket.id}`)
      })
    })
  }
}

// 导出单例
export const aiSocketService = new AiSocketService()
