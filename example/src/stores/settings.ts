import { defineStore } from 'pinia'
import { ref } from 'vue'
import configApi from '../api/modules/config'

export const useSettingsStore = defineStore('settings', () => {
  const geminiApiKey = ref<string>('')
  const isLoading = ref<boolean>(false)
  const initialized = ref<boolean>(false)

  // 保存设置到服务器
  async function saveSetting(type: string, value: string): Promise<void> {
    try {
      await configApi.upsertUserConfig(type, value)
    } catch (error) {
      console.error('保存设置失败:', error)
      throw error
    }
  }

  // 从服务器获取设置
  async function getSetting(type: string): Promise<string | null> {
    try {
      const response = await configApi.getUserConfigByType(type)
      if (response.data && response.data.value) {
        return response.data.value
      }
      return null
    } catch (error) {
      console.error('获取设置失败:', error)
      return null
    }
  }
  
  // 初始化
  async function initialize() {
    // 防止重复初始化
    if (initialized.value || isLoading.value) {
      return;
    }
    
    isLoading.value = true
    console.log('初始化设置...')
    
    try {
      const savedKey = await getSetting('geminiApiKey')
      if (savedKey) {
        geminiApiKey.value = savedKey
      }
      
      initialized.value = true
      console.log('设置初始化完成')
    } catch (error) {
      console.error('初始化设置失败:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  // 保存API密钥
  async function saveGeminiApiKey(apiKey: string) {
    isLoading.value = true
    try {
      await saveSetting('geminiApiKey', apiKey)
      geminiApiKey.value = apiKey
    } catch (error) {
      console.error('保存API密钥失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  // 清除API密钥
  async function clearGeminiApiKey() {
    isLoading.value = true
    try {
      await saveSetting('geminiApiKey', '')
      geminiApiKey.value = ''
    } catch (error) {
      console.error('清除API密钥失败:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }
  
  // 不再自动初始化
  // initialize()
  
  return {
    geminiApiKey,
    isLoading,
    initialized,
    initialize,
    saveGeminiApiKey,
    clearGeminiApiKey
  }
})
