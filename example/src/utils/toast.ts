import { ref } from 'vue'

type ToastType = 'info' | 'success' | 'error' | 'warning'

interface ToastState {
  show: boolean
  message: string
  type: ToastType
}

// 创建一个全局的toast状态
const globalToast = ref<ToastState>({
  show: false,
  message: '',
  type: 'info'
})

// 设置定时器ID
let toastTimer: number | null = null

/**
 * 显示全局Toast提示
 * @param message 提示消息
 * @param type 提示类型
 * @param duration 显示时长(毫秒)
 */
export function showToast(message: string, type: ToastType = 'info', duration: number = 3000) {
  // 清除之前的定时器
  if (toastTimer !== null) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  
  // 更新Toast状态
  globalToast.value = {
    show: true,
    message,
    type
  }
  
  // 设置自动关闭
  toastTimer = window.setTimeout(() => {
    hideToast()
  }, duration)
}

/**
 * 隐藏全局Toast提示
 */
export function hideToast() {
  globalToast.value.show = false
}

/**
 * 显示错误提示
 * @param message 错误消息
 * @param duration 显示时长(毫秒)
 */
export function showError(message: string, duration: number = 3000) {
  showToast(message, 'error', duration)
}

/**
 * 显示成功提示
 * @param message 成功消息
 * @param duration 显示时长(毫秒)
 */
export function showSuccess(message: string, duration: number = 3000) {
  showToast(message, 'success', duration)
}

/**
 * 显示警告提示
 * @param message 警告消息
 * @param duration 显示时长(毫秒)
 */
export function showWarning(message: string, duration: number = 3000) {
  showToast(message, 'warning', duration)
}

/**
 * 显示信息提示
 * @param message 信息消息
 * @param duration 显示时长(毫秒)
 */
export function showInfo(message: string, duration: number = 3000) {
  showToast(message, 'info', duration)
}

// 导出全局Toast状态
export { globalToast } 