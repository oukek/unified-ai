import { useUserStore } from '@/stores/user';
import { initSocket, disconnectSocket, getSocket } from './socket';

// Socket服务器配置
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5656';
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '';

// 初始化状态
let initialized = false;

/**
 * 初始化Socket管理器
 * 根据用户登录状态自动管理Socket连接
 */
export function initSocketManager() {
  // 防止重复初始化
  if (initialized) return;
  
  const userStore = useUserStore();
  
  // 监听登录状态变化
  userStore.$subscribe((_, state) => {
    // 检查登录状态 (通过手动检查token和currentUser)
    const isLoggedIn = !!state.token && !!state.currentUser;
    
    if (isLoggedIn) {
      // 用户已登录，尝试连接socket
      if (!getSocket()) {
        console.log('用户已登录，初始化Socket连接');
        initSocket({
          url: SOCKET_URL,
          path: SOCKET_PATH,
          token: state.token as string
        });
      }
    } else {
      // 用户未登录或登出，断开socket连接
      console.log('用户未登录或已登出，断开Socket连接');
      disconnectSocket();
    }
  });
  
  // 检查初始登录状态
  if (userStore.isLoggedIn && userStore.token) {
    console.log('检测到用户已登录，初始化Socket连接');
    initSocket({
      url: SOCKET_URL,
      path: SOCKET_PATH,
      token: userStore.token
    });
  }
  
  initialized = true;
}

/**
 * 获取当前Socket连接状态
 * @returns 是否已连接
 */
export function getSocketStatus() {
  const socket = getSocket();
  return {
    isConnected: socket?.connected || false,
    socketId: socket?.id || null
  };
}

export default {
  initSocketManager,
  getSocketStatus
}; 