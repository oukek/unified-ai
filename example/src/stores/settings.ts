import { defineStore } from 'pinia'
import { ref } from 'vue'
import { saveData, getData, DB, encrypt, decrypt } from '../utils/db'

export const useSettingsStore = defineStore('settings', () => {
  const geminiApiKey = ref<string>('')
  const isLoading = ref<boolean>(false)
  
  // 保存设置
  async function saveSetting(key: string, value: string): Promise<void> {
    try {
      // 加密值
      const encryptedValue = encrypt(value)
      await saveData(DB.STORES.SETTINGS, { key, value: encryptedValue })
    } catch (error) {
      console.error('保存设置失败:', error)
      throw error
    }
  }

  // 获取设置
  async function getSetting(key: string): Promise<string | null> {
    try {
      const data = await getData<{key: string, value: string}>(DB.STORES.SETTINGS, key)
      if (data && data.value) {
        try {
          // 解密值
          return decrypt(data.value)
        } catch (error) {
          console.error('解密设置值失败:', error)
          return null
        }
      }
      return null
    } catch (error) {
      console.error('获取设置失败:', error)
      return null
    }
  }
  
  // 初始化
  async function initialize() {
    isLoading.value = true
    try {
      const savedKey = await getSetting('geminiApiKey')
      if (savedKey) {
        geminiApiKey.value = savedKey
      }
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
  
  // 自动初始化
  initialize()
  
  return {
    geminiApiKey,
    isLoading,
    initialize,
    saveGeminiApiKey,
    clearGeminiApiKey
  }
})
