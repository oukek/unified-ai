import { io, Socket } from 'socket.io-client';

// Socket单例实例
let socket: Socket | null = null;

/**
 * Socket连接配置选项
 */
interface SocketOptions {
  url: string;
  path?: string;
  query?: Record<string, string>;
  auth?: Record<string, any>;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  timeout?: number;
  token?: string;
}

/**
 * 事件监听器类型
 */
type EventListener = (...args: any[]) => void;

/**
 * 初始化并连接Socket
 * @param options Socket连接配置
 * @returns Socket实例
 */
export function initSocket(options: SocketOptions): Socket | null {
  if (!options.token) {
    console.warn('未提供token，Socket连接初始化失败');
    return null;
  }

  if (socket) {
    socket.disconnect();
  }

  const { url, token, ...socketOptions } = options;
  
  socket = io(url, {
    ...socketOptions,
    autoConnect: true,
    transports: ['websocket', 'polling'],
    auth: {
      ...socketOptions.auth,
      token
    }
  });

  socket.on('connect', () => {
    console.log('Socket连接成功，ID:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket断开连接:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket连接错误:', error);
  });

  return socket;
}

/**
 * 获取当前Socket实例
 * @returns Socket实例
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * 断开Socket连接
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * 重新连接Socket
 */
export function reconnectSocket(): void {
  if (socket) {
    socket.connect();
  }
}

/**
 * 发送事件
 * @param event 事件名称
 * @param data 事件数据
 */
export function emitEvent(event: string, ...data: any[]): void {
  if (socket) {
    socket.emit(event, ...data);
  } else {
    console.error('Socket未连接，无法发送事件');
  }
}

/**
 * 监听事件
 * @param event 事件名称
 * @param listener 监听器函数
 */
export function onEvent(event: string, listener: EventListener): void {
  if (socket) {
    socket.on(event, listener);
  } else {
    console.error('Socket未连接，无法监听事件');
  }
}

/**
 * 移除特定事件的监听器
 * @param event 事件名称
 * @param listener 要移除的监听器函数
 */
export function offEvent(event: string, listener?: EventListener): void {
  if (socket) {
    if (listener) {
      socket.off(event, listener);
    } else {
      socket.off(event);
    }
  }
}

/**
 * 移除所有事件监听器
 */
export function offAllEvents(): void {
  if (socket) {
    socket.removeAllListeners();
  }
}

/**
 * 检查Socket是否已连接
 * @returns 是否已连接
 */
export function isConnected(): boolean {
  return socket?.connected || false;
}

/**
 * Socket工具类
 */
export default {
  initSocket,
  getSocket,
  disconnectSocket,
  reconnectSocket,
  emitEvent,
  onEvent,
  offEvent,
  offAllEvents,
  isConnected,
}; 