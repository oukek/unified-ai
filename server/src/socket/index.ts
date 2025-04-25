import { Server, Socket } from 'socket.io';

/**
 * 设置 Socket.io 事件处理器
 */
export function setupSocketHandlers(io: Server): void {
  // 连接事件
  io.on('connection', (socket: Socket) => {
    console.log(`用户连接: ${socket.id}`);

    // 加入房间
    socket.on('join-room', (roomId: string) => {
      socket.join(roomId);
      console.log(`用户 ${socket.id} 加入房间: ${roomId}`);
    });

    // 离开房间
    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId);
      console.log(`用户 ${socket.id} 离开房间: ${roomId}`);
    });

    // 发送消息
    socket.on('send-message', (data: { roomId: string; message: string; }) => {
      io.to(data.roomId).emit('receive-message', {
        sender: socket.id,
        message: data.message,
        timestamp: new Date().toISOString()
      });
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`用户断开连接: ${socket.id}`);
    });
  });
} 