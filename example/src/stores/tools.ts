import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import toolApi from '../api/modules/tool'
import type { Tool } from '../api/types'

interface ToolConfig {
  enabled: boolean
  configs: Record<string, string>
}

export const useToolsStore = defineStore('tools', () => {
  // 工具配置状态
  const tools = ref<Tool[]>([])
  const toolConfigs = ref<Record<string, ToolConfig>>({})
  const isLoading = ref<boolean>(false)
  const initialized = ref<boolean>(false)
  
  // 获取所有可用工具
  const allTools = computed(() => tools.value)
  
  // 获取已启用的工具
  const enabledTools = computed(() => {
    return tools.value.filter(tool => {
      const config = toolConfigs.value[tool.name]
      if (!config) return false
      
      // 检查是否启用
      if (!config.enabled) return false
      
      // 检查必要的配置是否已填写
      if (tool.configRequired) {
        for (const key of tool.configRequired) {
          if (!config.configs[key.name]) {
            return false
          }
        }
      }
      
      return true
    })
  })
  
  // 检查工具是否可用（配置完整）
  function isToolAvailable(toolName: string): boolean {
    const tool = tools.value.find(t => t.name === toolName)
    if (!tool) return false
    
    // 如果没有必需配置，则直接可用
    if (!tool.configRequired || tool.configRequired.length === 0) {
      return true
    }
    
    // 检查必要配置
    const config = toolConfigs.value[toolName]
    if (!config) return false
    
    for (const key of tool.configRequired) {
      if (!config.configs[key.name]) {
        return false
      }
    }
    
    return true
  }
  
  // 保存工具配置到服务器
  async function saveToolConfig(toolName: string, config: ToolConfig): Promise<void> {
    try {
      // 更新内存中的配置
      toolConfigs.value[toolName] = config
      
      // 准备工具配置数据
      const enabledTools = Object.entries(toolConfigs.value)
        .filter(([_, config]) => config.enabled)
        .map(([name]) => name)
      
      const toolConfigsData = Object.fromEntries(
        Object.entries(toolConfigs.value).map(([name, config]) => [name, config.configs])
      )
      
      // 保存到服务器
      await toolApi.updateUserTools(enabledTools, toolConfigsData)
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
  
  // 初始化工具配置
  async function initialize() {
    // 防止重复初始化
    if (initialized.value || isLoading.value) {
      return;
    }
    
    isLoading.value = true;
    console.log('初始化工具配置...');
    
    try {
      // 1. 先获取后端支持的所有工具
      const toolsResponse = await toolApi.getAllTools()
      if (toolsResponse.data) {
        // 将API工具转换为本地工具对象
        tools.value = toolsResponse.data
      }
      
      // 2. 获取用户已启用的工具配置
      const userToolsResponse = await toolApi.getUserTools()
      if (userToolsResponse.data) {
        const { enabledTools: userEnabledTools, toolConfigs: userToolConfigs } = userToolsResponse.data
        
        // 初始化每个工具的配置
        for (const tool of tools.value) {
          const isEnabled = userEnabledTools.includes(tool.name)
          const configs = userToolConfigs[tool.name] || {}
          
          toolConfigs.value[tool.name] = {
            enabled: isEnabled,
            configs
          }
        }
      }
      
      initialized.value = true;
      console.log('工具配置初始化完成');
    } catch (error) {
      console.error('初始化工具配置失败:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  
  return {
    allTools,
    enabledTools,
    toolConfigs,
    isLoading,
    initialized,
    isToolAvailable,
    toggleToolEnabled,
    setToolConfigItem,
    initialize
  }
}) 