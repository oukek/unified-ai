import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api'
import type { User } from '@/api/types'

export const useUserStore = defineStore('user', () => {
  // 用户信息
  const currentUser = ref<User | null>(null)
  
  // token管理
  const token = ref<string | null>(null)
  
  // 初始化状态
  const isInitialized = ref(false)
  
  // 登录状态
  const isLoggedIn = computed(() => !!token.value && !!currentUser.value)
  
  // 初始化，从本地存储加载token和用户信息
  const initialize = () => {
    // 已初始化则跳过
    if (isInitialized.value) return
    
    // 从localStorage加载token
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      token.value = savedToken
      
      // 尝试加载用户信息
      const savedUser = localStorage.getItem('user')
      if (savedUser) {
        try {
          currentUser.value = JSON.parse(savedUser)
        } catch (e) {
          console.error('解析用户信息失败', e)
          // 解析失败则清除缓存
          localStorage.removeItem('user')
        }
      }
      
      // 验证token有效性
      fetchCurrentUser()
    }
    
    // 标记为已初始化
    isInitialized.value = true
  }
  
  // 注册
  const register = async (username: string, password: string) => {
    try {
      const response = await authApi.register(username, password)
      return { success: true, data: response.data }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '注册失败，请稍后重试'
      }
    }
  }
  
  // 登录
  const login = async (username: string, password: string) => {
    try {
      const response = await authApi.login(username, password)
      const { token: newToken, user } = response.data
      
      // 保存token和用户信息
      token.value = newToken
      currentUser.value = user
      
      // 保存到本地存储
      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(user))
      
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || '登录失败，请检查用户名和密码'
      }
    }
  }
  
  // 获取当前用户信息
  const fetchCurrentUser = async () => {
    if (!token.value) return
    
    try {
      const response = await authApi.getCurrentUser()
      currentUser.value = response.data.user
      
      // 更新本地存储
      localStorage.setItem('user', JSON.stringify(response.data.user))
      
      return { success: true }
    } catch (error: any) {
      // 如果401错误，清除登录信息
      if (error.response?.status === 401) {
        logout()
      }
      
      return {
        success: false,
        message: error.response?.data?.message || '获取用户信息失败'
      }
    }
  }
  
  // 退出登录
  const logout = () => {
    // 清除状态
    token.value = null
    currentUser.value = null
    
    // 清除本地存储
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }
  
  return {
    currentUser,
    token,
    isLoggedIn,
    isInitialized,
    initialize,
    register,
    login,
    fetchCurrentUser,
    logout
  }
})

export default useUserStore 