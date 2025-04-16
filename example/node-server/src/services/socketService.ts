import type { Server as HttpServer } from 'node:http'
import type { Socket } from 'socket.io'
import { Server } from 'socket.io'

/**
 * Socket.IO 服务封装
 */
class SocketService {
  private io: Server | null = null

  /**
   * 初始化 Socket.IO 服务
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: '*', // 允许跨域访问
        methods: ['GET', 'POST'],
      },
    })

    this.setupEventHandlers()
    console.log('Socket.IO 服务已初始化')
  }

  /**
   * 获取Socket.IO实例
   */
  getIoInstance(): Server {
    if (!this.io) {
      throw new Error('Socket.IO 服务尚未初始化')
    }
    return this.io
  }

  /**
   * 设置事件处理程序
   */
  private setupEventHandlers(): void {
    if (!this.io)
      return

    this.io.on('connection', (socket: Socket) => {
      console.log(`用户已连接: ${socket.id}`)

      // 简单的消息处理 - 与前端 ApiDemo 组件对接
      socket.on('message', (message) => {
        console.log(`收到普通消息: ${message}`)
        // 回显消息给所有客户端
        this.io?.emit('message', `服务器回复: ${message}`)
      })

      // 处理聊天消息
      socket.on('chat:message', (message) => {
        this.handleChatMessage(socket, message)
      })

      // 处理用户加入房间
      socket.on('room:join', (roomId) => {
        this.handleJoinRoom(socket, roomId)
      })

      // 处理用户离开房间
      socket.on('room:leave', (roomId) => {
        this.handleLeaveRoom(socket, roomId)
      })

      // 处理断开连接
      socket.on('disconnect', () => {
        console.log(`用户已断开连接: ${socket.id}`)
      })
    })
  }

  /**
   * 处理聊天消息
   */
  private handleChatMessage(socket: Socket, message: any): void {
    console.log(`收到消息: ${JSON.stringify(message)}`)

    // 广播消息到房间或全局
    if (message.roomId) {
      socket.to(message.roomId).emit('chat:message', {
        userId: socket.id,
        text: message.text,
        timestamp: new Date(),
      })
    }
    else {
      socket.broadcast.emit('chat:message', {
        userId: socket.id,
        text: message.text,
        timestamp: new Date(),
      })
    }
  }

  /**
   * 处理用户加入房间
   */
  private handleJoinRoom(socket: Socket, roomId: string): void {
    socket.join(roomId)
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`)

    // 通知房间内的其他用户
    socket.to(roomId).emit('room:userJoined', {
      userId: socket.id,
      roomId,
      timestamp: new Date(),
    })
  }

  /**
   * 处理用户离开房间
   */
  private handleLeaveRoom(socket: Socket, roomId: string): void {
    socket.leave(roomId)
    console.log(`用户 ${socket.id} 离开房间 ${roomId}`)

    // 通知房间内的其他用户
    socket.to(roomId).emit('room:userLeft', {
      userId: socket.id,
      roomId,
      timestamp: new Date(),
    })
  }

  /**
   * 向所有客户端广播消息
   */
  broadcastToAll(event: string, data: any): void {
    if (!this.io)
      return
    this.io.emit(event, data)
  }

  /**
   * 向特定房间广播消息
   */
  broadcastToRoom(roomId: string, event: string, data: any): void {
    if (!this.io)
      return
    this.io.to(roomId).emit(event, data)
  }

  /**
   * 向特定客户端发送消息
   */
  sendToClient(socketId: string, event: string, data: any): void {
    if (!this.io)
      return
    this.io.to(socketId).emit(event, data)
  }
}

// 导出单例
export const socketService = new SocketService()
