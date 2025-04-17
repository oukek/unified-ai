import type { Server } from 'socket.io'
import type { CallbackState, ChatOptions } from './aiService'
import { AgentEventType, ChatRole } from '@oukek/unified-ai'
import { aiService } from './aiService'
import { historyService } from './historyService'

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
        const { prompt, model, historyId } = data

        if (!prompt) {
          socket.emit('ai:error', {
            message: '缺少聊天内容',
            timestamp: Date.now(),
            chatId: historyId || '',
            messageId: '',
          })
          return
        }

        try {
          // 如果有historyId，从历史记录中获取history和systemMessage
          let history
          let systemMessage
          let messageId = ''

          if (historyId) {
            const historyDetail = await historyService.getHistoryDetail(historyId)
            if (historyDetail) {
              // 提取历史对话记录
              history = historyDetail.messages.map(msg => ({
                role: msg.role === 'user'
                  ? ChatRole.USER
                  : msg.role === 'assistant'
                    ? ChatRole.ASSISTANT
                    : ChatRole.SYSTEM,
                content: msg.content,
                ...(msg.functionCalls ? { functionCalls: msg.functionCalls } : {}),
                ...(msg.functionResults ? { functionResults: msg.functionResults } : {}),
              }))
              // 提取系统消息
              systemMessage = historyDetail.systemMessage
              // 生成新消息ID
              messageId = `${historyId}_${historyDetail.messages.length + 1}`
            }
          }

          socket.emit('ai:start', {
            message: '开始生成回复...',
            timestamp: Date.now(),
            chatId: historyId,
            messageId,
          })

          // 定义回调函数处理各种状态
          const callback = (state: CallbackState, data: any) => {
            const timestamp = Date.now()

            switch (state) {
              case AgentEventType.RESPONSE_START:
                socket.emit('ai:response_start', {
                  prompt: data.prompt,
                  timestamp,
                  chatId: historyId,
                  messageId,
                })
                break

              case AgentEventType.FUNCTION_CALL_START:
                socket.emit('ai:function_call_start', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                  })),
                  timestamp,
                  chatId: historyId,
                  messageId,
                })
                break

              case AgentEventType.FUNCTION_CALL_END:
                socket.emit('ai:function_call_end', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                    result: f.result,
                  })),
                  timestamp,
                  chatId: historyId,
                  messageId,
                })
                break

              case AgentEventType.RESPONSE_CHUNK:
                // 流式响应的每个块由下面的for循环处理
                break

              case AgentEventType.RESPONSE_END:
                // 流式响应的结束由下面的for循环处理
                break

              case AgentEventType.ERROR:
                socket.emit('ai:error', {
                  message: data.error.message || '处理请求时出错',
                  timestamp,
                  chatId: historyId,
                  messageId,
                })
                break
            }
          }

          // 聊天选项
          const chatOptions: ChatOptions = {
            model,
            systemMessage,
            history,
            historyId,
            callback,
          }

          console.log('开始生成回复...')
          const generator = aiService.chatStream(prompt, chatOptions)
          let isCompleted = false

          if (!generator) {
            socket.emit('ai:error', {
              message: 'AI服务未初始化',
              timestamp: Date.now(),
              chatId: historyId || '',
              messageId,
            })
            return
          }

          for await (const chunk of generator) {
            if (!chunk) {
              socket.emit('ai:error', {
                message: '生成回复失败',
                timestamp: Date.now(),
                chatId: historyId,
                messageId,
              })
              break
            }

            socket.emit('ai:chunk', {
              content: chunk.content,
              isLast: chunk.isLast,
              model: chunk.model,
              timestamp: Date.now(),
              chatId: historyId,
              messageId,
            })

            if (chunk.isLast) {
              isCompleted = true
              socket.emit('ai:end', {
                message: '生成完成',
                model: chunk.model,
                timestamp: Date.now(),
                chatId: historyId,
                messageId,
              })
            }
          }

          if (!isCompleted) {
            socket.emit('ai:end', {
              message: '生成完成',
              timestamp: Date.now(),
              chatId: historyId,
              messageId,
            })
          }
        }
        catch (error) {
          console.error('处理流式聊天请求失败:', error)
          socket.emit('ai:error', {
            message: '处理流式聊天请求失败',
            timestamp: Date.now(),
            chatId: historyId,
            messageId: '',
          })
        }
      })

      // 普通聊天请求（带实时状态回调）
      socket.on('ai:chat', async (data) => {
        const { prompt, model, historyId } = data

        if (!prompt) {
          socket.emit('ai:error', {
            message: '缺少聊天内容',
            timestamp: Date.now(),
            chatId: historyId || '',
            messageId: '',
          })
          return
        }

        try {
          // 如果有historyId，从历史记录中获取history和systemMessage
          let history
          let systemMessage
          let messageId = ''

          if (historyId) {
            const historyDetail = await historyService.getHistoryDetail(historyId)
            if (historyDetail) {
              // 提取历史对话记录
              history = historyDetail.messages.map(msg => ({
                role: msg.role === 'user'
                  ? ChatRole.USER
                  : msg.role === 'assistant'
                    ? ChatRole.ASSISTANT
                    : ChatRole.SYSTEM,
                content: msg.content,
                ...(msg.functionCalls ? { functionCalls: msg.functionCalls } : {}),
                ...(msg.functionResults ? { functionResults: msg.functionResults } : {}),
              }))
              // 提取系统消息
              systemMessage = historyDetail.systemMessage
              // 生成新消息ID
              messageId = `${historyId}_${historyDetail.messages.length + 1}`
            }
          }

          socket.emit('ai:start', {
            message: '开始生成回复...',
            timestamp: Date.now(),
            chatId: historyId,
            messageId,
          })

          // 定义回调函数处理各种状态
          const callback = (state: CallbackState, data: any) => {
            const timestamp = Date.now()

            switch (state) {
              case 'response_start':
                socket.emit('ai:response_start', {
                  prompt: data.prompt,
                  timestamp,
                  chatId: historyId,
                  messageId,
                })
                break

              case 'function_call_start':
                socket.emit('ai:function_call_start', {
                  functionCalls: data.functionCalls.map((f: any) => ({
                    name: f.name,
                    arguments: f.arguments,
                  })),
                  timestamp,
                  chatId: historyId,
                  messageId,
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
                  chatId: historyId,
                  messageId,
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
                  chatId: historyId,
                  messageId,
                })
                break
            }
          }

          // 聊天选项
          const chatOptions: ChatOptions = {
            model,
            systemMessage,
            history,
            historyId,
            callback,
          }

          const response = await aiService.chat(prompt, chatOptions)

          if (!response) {
            socket.emit('ai:error', {
              message: 'AI服务未初始化或请求失败',
              timestamp: Date.now(),
              chatId: historyId,
              messageId,
            })
            return
          }

          socket.emit('ai:response', {
            content: response.content,
            model: response.model,
            functionCalls: (response as any).functionCalls || [],
            timestamp: Date.now(),
            chatId: historyId,
            messageId,
          })

          socket.emit('ai:end', {
            message: '生成完成',
            model: response.model,
            timestamp: Date.now(),
            chatId: historyId,
            messageId,
          })
        }
        catch (error) {
          console.error('处理聊天请求失败:', error)
          socket.emit('ai:error', {
            message: '处理聊天请求失败',
            timestamp: Date.now(),
            chatId: historyId,
            messageId: '',
          })
        }
      })

      // 创建新的聊天历史记录
      socket.on('ai:create-history', async (data) => {
        const { title, model, systemMessage, initialMessage } = data

        try {
          const historyId = await aiService.createChatHistory({
            title,
            model,
            systemMessage,
            initialMessage,
          })

          socket.emit('ai:history-created', {
            historyId,
            chatId: historyId,
            timestamp: Date.now(),
          })
        }
        catch (error) {
          console.error('创建聊天历史记录失败:', error)
          socket.emit('ai:error', {
            message: '创建聊天历史记录失败',
            timestamp: Date.now(),
            chatId: '',
            messageId: '',
          })
        }
      })

      // 获取历史记录列表
      socket.on('ai:get-history-list', async () => {
        try {
          const list = await historyService.getHistoryList()
          socket.emit('ai:history-list', {
            list,
            timestamp: Date.now(),
          })
        }
        catch (error) {
          console.error('获取历史记录列表失败:', error)
          socket.emit('ai:error', {
            message: '获取历史记录列表失败',
            timestamp: Date.now(),
            chatId: '',
            messageId: '',
          })
        }
      })

      // 获取历史记录详情
      socket.on('ai:get-history-detail', async (data) => {
        const { historyId } = data

        try {
          const detail = await historyService.getHistoryDetail(historyId)

          if (!detail) {
            socket.emit('ai:error', {
              message: '历史记录不存在',
              timestamp: Date.now(),
              chatId: historyId,
              messageId: '',
            })
            return
          }

          socket.emit('ai:history-detail', {
            detail,
            chatId: historyId,
            timestamp: Date.now(),
          })
        }
        catch (error) {
          console.error('获取历史记录详情失败:', error)
          socket.emit('ai:error', {
            message: '获取历史记录详情失败',
            timestamp: Date.now(),
            chatId: historyId || '',
            messageId: '',
          })
        }
      })

      // 删除历史记录
      socket.on('ai:delete-history', async (data) => {
        const { historyId } = data

        try {
          const success = await historyService.deleteHistory(historyId)

          socket.emit('ai:history-deleted', {
            success,
            historyId,
            chatId: historyId,
            timestamp: Date.now(),
          })
        }
        catch (error) {
          console.error('删除历史记录失败:', error)
          socket.emit('ai:error', {
            message: '删除历史记录失败',
            timestamp: Date.now(),
            chatId: historyId || '',
            messageId: '',
          })
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
