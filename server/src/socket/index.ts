import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { SocketKey } from './key';
import { AIController } from '../controllers/AIController';

// JWT密钥，应该从环境变量中获取
const JWT_SECRET = process.env.JWT_SECRET || 'unifiedai_secret_key';

// 全局变量存储 Socket.io 服务器实例
declare global {
  var socketServer: Server | undefined;
}

// AI控制器
const aiController = new AIController();

/**
 * Socket 认证中间件
 */
const authenticateSocketToken = (socket: Socket, next: (err?: Error) => void) => {
  // 从请求头获取令牌
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]; 
  
  if (!token) {
    return next(new Error('未提供访问令牌'));
  }
  
  try {
    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
    // 将用户信息附加到 socket 上
    (socket as any).user = decoded;
    next();
  } catch (error) {
    console.error('验证 Socket 令牌失败:', error);
    next(new Error('无效或过期的令牌'));
  }
};

/**
 * 设置 Socket.io 事件处理器
 */
export function setupSocketHandlers(io: Server): void {
  // 保存 Socket.io 服务器实例到全局变量
  globalThis.socketServer = io;
  console.log('Socket.io 实例已保存到全局变量');
  
  // 添加认证中间件
  io.use(authenticateSocketToken);
  console.log('Socket 认证中间件已添加');

  // 连接事件
  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`用户连接: ${socket.id}, 用户信息:`, user);
    joinRoom(socket.id, SocketKey.room.user(user.id))
    console.log(`用户 ${user.id} 已加入房间: ${SocketKey.room.user(user.id)}`);
    
    // 添加断开连接的日志
    socket.on('disconnect', () => {
      console.log(`用户断开连接: ${socket.id}, 用户信息:`, user);
    });
    
    // 处理AI聊天流式请求
    socket.on('ai:chatStream', async (data: { conversationId: string; content: string }, callback) => {
      try {
        if (!data.conversationId || !data.content) {
          callback({ success: false, error: '会话ID和消息内容不能为空' });
          return;
        }
        
        // 创建专门的房间用于此次对话
        const chatRoomId = `chat_${data.conversationId}_${Date.now()}`;
        socket.join(chatRoomId);
        
        // 创建回调函数，将AI事件发送到客户端
        const socketCallback = (eventType: string, eventData: any) => {
          socket.emit('ai:chatUpdate', { 
            type: eventType, 
            data: eventData,
            conversationId: data.conversationId
          });
        };
        
        // 调用AI处理函数，传入socket回调
        const result = await aiController.handleStreamMessage(
          user.id,
          data.conversationId,
          data.content,
          socketCallback
        );
        
        // 发送完成事件
        socket.emit('ai:chatComplete', { 
          success: true, 
          result,
          conversationId: data.conversationId
        });
        
        // 离开聊天房间
        socket.leave(chatRoomId);
        
        // 返回成功结果
        callback({ success: true });
      } catch (error) {
        console.error('AI聊天处理失败:', error);
        const errorMsg = error instanceof Error ? error.message : '处理失败';
        callback({ 
          success: false, 
          error: errorMsg
        });
        
        // 同时通过WebSocket发送错误通知
        socket.emit('ai:chatError', { 
          error: errorMsg,
          conversationId: data.conversationId
        });
      }
    });
  });
  
  console.log('Socket 连接事件监听器已设置');
}

/**
 * 获取Socket.io服务器实例
 * @returns Socket.io Server实例
 */
export function getSocketServer(): Server | null {
  if (!globalThis.socketServer) {
    console.warn('Socket服务器尚未初始化');
    return null;
  }
  return globalThis.socketServer as Server;
}

/**
 * 向指定房间发送消息
 * @param room 房间名称
 * @param event 事件名称
 * @param data 要发送的数据
 * @returns 是否发送成功
 */
export function emitToRoom(room: string, event: string, data: any): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  server.to(room).emit(event, data);
  return true;
}

/**
 * 向指定客户端发送消息
 * @param clientId 客户端ID
 * @param event 事件名称
 * @param data 要发送的数据
 * @returns 是否发送成功
 */
export function emitToClient(clientId: string, event: string, data: any): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  server.to(clientId).emit(event, data);
  return true;
}

/**
 * 向所有客户端广播消息
 * @param event 事件名称
 * @param data 要发送的数据
 * @returns 是否发送成功
 */
export function broadcastMessage(event: string, data: any): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  server.emit(event, data);
  return true;
}

/**
 * 将客户端加入指定房间
 * @param clientId 客户端ID
 * @param room 房间名称
 * @returns 是否成功
 */
export function joinRoom(clientId: string, room: string): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  const socket = server.sockets.sockets.get(clientId);
  if (!socket) {
    console.warn(`joinRoom: 客户端 ${clientId} 不存在`);
    return false;
  }

  socket.join(room);
  return true;
}

/**
 * 将客户端从指定房间移除
 * @param clientId 客户端ID
 * @param room 房间名称
 * @returns 是否成功
 */
export function leaveRoom(clientId: string, room: string): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  const socket = server.sockets.sockets.get(clientId);
  if (!socket) {
    console.warn(`leaveRoom: 客户端 ${clientId} 不存在`);
    return false;
  }

  socket.leave(room);
  return true;
}

/**
 * 获取客户端所在的所有房间
 * @param clientId 客户端ID
 * @returns 房间列表
 */
export async function getClientRooms(clientId: string): Promise<string[]> {
  const server = getSocketServer();
  if (!server)
    return [];

  try {
    // 使用 Socket.io 的 fetchSockets API 获取完整信息
    const sockets = await server.in(clientId).fetchSockets();
    if (sockets.length > 0) {
      return Array.from(sockets[0].rooms);
    }
  }
  catch (error) {
    console.error('获取客户端房间信息失败:', error);
  }
  return [];
}

/**
 * 获取房间中的所有客户端
 * @param room 房间名称
 * @returns 客户端ID列表
 */
export async function getRoomClients(room: string): Promise<string[]> {
  const server = getSocketServer();
  if (!server)
    return [];

  try {
    // 使用 Socket.io 的 fetchSockets API 获取完整信息
    const sockets = await server.in(room).fetchSockets();
    return sockets.map(socket => socket.id);
  }
  catch (error) {
    console.error('获取房间客户端信息失败:', error);
  }
  return [];
}

/**
 * 将客户端从所有房间移除
 * @param clientId 客户端ID
 * @returns 是否成功
 */
export function leaveAllRooms(clientId: string): boolean {
  const server = getSocketServer();
  if (!server)
    return false;

  const socket = server.sockets.sockets.get(clientId);
  if (!socket) {
    console.warn(`leaveAllRooms: 客户端 ${clientId} 不存在`);
    return false;
  }

  socket.rooms.forEach((room) => {
    if (room !== socket.id) { // 不离开自己的默认房间
      socket.leave(room);
    }
  });
  return true;
} 