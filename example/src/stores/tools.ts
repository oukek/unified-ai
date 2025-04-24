import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { saveData, getData, DB, encrypt, decrypt } from '../utils/db'
import { availableTools } from '../utils/tools'

// 确保 DB.STORES.TOOLS 存在
interface ExtendedStoreNames {
  TOOLS: string
}

// 扩展 DB.STORES 类型
const ExtendedDB = {
  ...DB,
  STORES: {
    ...DB.STORES,
    TOOLS: 'tools'
  } as typeof DB.STORES & ExtendedStoreNames
}

interface ToolConfig {
  enabled: boolean
  configs: Record<string, string>
}

export const useToolsStore = defineStore('tools', () => {
  // 工具配置状态
  const toolConfigs = ref<Record<string, ToolConfig>>({})
  const isLoading = ref<boolean>(false)
  
  // 获取所有可用工具
  const allTools = computed(() => availableTools)
  
  // 获取已启用的工具
  const enabledTools = computed(() => {
    return allTools.value.filter(tool => {
      const config = toolConfigs.value[tool.name]
      if (!config) return false
      
      // 检查是否启用
      if (!config.enabled) return false
      
      // 检查必要的配置是否已填写
      if (tool.configRequired) {
        for (const key of tool.configRequired) {
          if (!config.configs[key]) {
            return false
          }
        }
      }
      
      return true
    })
  })
  
  // 检查工具是否可用（配置完整）
  function isToolAvailable(toolName: string): boolean {
    const tool = allTools.value.find(t => t.name === toolName)
    if (!tool) return false
    
    // 如果没有必需配置，则直接可用
    if (!tool.configRequired || tool.configRequired.length === 0) {
      return true
    }
    
    // 检查必要配置
    const config = toolConfigs.value[toolName]
    if (!config) return false
    
    for (const key of tool.configRequired) {
      if (!config.configs[key]) {
        return false
      }
    }
    
    return true
  }
  
  // 保存工具配置
  async function saveToolConfig(toolName: string, config: ToolConfig): Promise<void> {
    try {
      // 加密配置值
      const encryptedConfig: ToolConfig = {
        enabled: config.enabled,
        configs: {}
      }
      
      for (const [key, value] of Object.entries(config.configs)) {
        encryptedConfig.configs[key] = encrypt(value)
      }
      
      // 更新内存中的配置
      toolConfigs.value[toolName] = config
      
      // 保存到数据库
      await saveData(ExtendedDB.STORES.TOOLS, { 
        key: toolName, 
        value: JSON.stringify(encryptedConfig) 
      })
    } catch (error) {
      console.error('保存工具配置失败:', error)
      throw error
    }
  }
  
  // 启用或禁用工具
  async function toggleToolEnabled(toolName: string, enabled: boolean): Promise<void> {
    try {
      const config = toolConfigs.value[toolName] || { enabled: false, configs: {} }
      config.enabled = enabled
      
      // 保存配置
      await saveToolConfig(toolName, config)
    } catch (error) {
      console.error('切换工具状态失败:', error)
      throw error
    }
  }
  
  // 设置工具配置项
  async function setToolConfigItem(toolName: string, key: string, value: string): Promise<void> {
    try {
      const config = toolConfigs.value[toolName] || { enabled: false, configs: {} }
      config.configs[key] = value
      
      // 保存配置
      await saveToolConfig(toolName, config)
    } catch (error) {
      console.error('设置工具配置失败:', error)
      throw error
    }
  }
  
  // 获取工具配置
  async function getToolConfig(toolName: string): Promise<ToolConfig | null> {
    try {
      const data = await getData<{key: string, value: string}>(ExtendedDB.STORES.TOOLS, toolName)
      if (data && data.value) {
        try {
          // 解析配置
          const encryptedConfig = JSON.parse(data.value) as ToolConfig
          
          // 解密配置值
          const decryptedConfig: ToolConfig = {
            enabled: encryptedConfig.enabled,
            configs: {}
          }
          
          for (const [key, value] of Object.entries(encryptedConfig.configs)) {
            decryptedConfig.configs[key] = decrypt(value)
          }
          
          return decryptedConfig
        } catch (error) {
          console.error('解析工具配置失败:', error)
          return null
        }
      }
      return null
    } catch (error) {
      console.error('获取工具配置失败:', error)
      return null
    }
  }
  
  // 初始化工具配置
  async function initialize() {
    isLoading.value = true
    try {
      // 为每个工具加载配置
      for (const tool of allTools.value) {
        const config = await getToolConfig(tool.name)
        if (config) {
          toolConfigs.value[tool.name] = config
        } else {
          // 创建默认配置
          toolConfigs.value[tool.name] = {
            enabled: false,
            configs: {}
          }
        }
      }
    } catch (error) {
      console.error('初始化工具配置失败:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  // 执行工具
  async function executeTool(toolName: string, params: Record<string, any>): Promise<any> {
    // 查找工具
    const tool = allTools.value.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`工具 "${toolName}" 不存在`)
    }
    
    // 检查工具是否已启用
    if (!enabledTools.value.includes(tool)) {
      throw new Error(`工具 "${toolName}" 未启用或配置不完整`)
    }
    
    // 执行工具
    return await tool.executor(params)
  }
  
  // 获取已启用的工具，转换为适合 addFunctions 使用的格式
  function getEnabledTools() {
    return enabledTools.value.map(tool => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        executor: async (params: Record<string, any>) => {
          // 获取工具配置并合并到参数中
          const toolConfig = toolConfigs.value[tool.name]
          const mergedParams = {
            ...params,
            ...toolConfig?.configs
          }
          
          // 执行工具
          return await executeTool(tool.name, mergedParams)
        }
      }
    })
  }
  
  // 自动初始化
  initialize()
  
  return {
    allTools,
    enabledTools,
    toolConfigs,
    isLoading,
    isToolAvailable,
    toggleToolEnabled,
    setToolConfigItem,
    executeTool,
    getEnabledTools,
    initialize
  }
})

// 修改数据库定义，添加工具存储
import '../utils/db'
declare module '../utils/db' {
  interface StoreNames {
    TOOLS: string
  }
}

// 添加工具存储定义，如果不存在
if (!DB.STORES.TOOLS) {
  DB.STORES.TOOLS = 'tools'
} 