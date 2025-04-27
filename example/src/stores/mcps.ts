import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mcpApi } from '../api/modules/mcp'
import type { Mcp } from '../api/types'

// MCP配置类型
interface McpConfig {
  enabled: boolean;
  configs: {
    desc?: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
  };
}

export const useMcpsStore = defineStore('mcps', () => {
  // MCP相关状态
  const mcps = ref<Mcp[]>([])
  const mcpConfigs = ref<Record<string, McpConfig>>({})
  const isLoading = ref<boolean>(false)
  const initialized = ref<boolean>(false)
  
  // 获取所有MCP
  const allMcps = computed(() => mcps.value)
  
  // 获取已启用的MCP
  const enabledMcps = computed(() => 
    Object.entries(mcpConfigs.value)
      .filter(([_, config]) => config.enabled)
      .map(([name]) => name)
  )
  
  // 获取当前激活的MCP（单选模式下，只能有一个）
  const activeMcp = computed(() => enabledMcps.value.length > 0 ? enabledMcps.value[0] : null)
  
  // 检查MCP是否可用
  function isMcpAvailable(mcpName: string): boolean {
    const config = mcpConfigs.value[mcpName]
    if (!config || !config.enabled) {
      return false
    }
    
    // 判断必要的配置是否齐全
    const { command, args } = config.configs
    return !!command && Array.isArray(args)
  }
  
  // 保存MCP配置到服务器
  async function saveMcpConfig(mcpName: string, config: McpConfig): Promise<void> {
    try {
      // 更新内存中的配置
      mcpConfigs.value[mcpName] = config
      
      // 如果启用了此MCP，则确保其他MCP被禁用（单选模式）
      if (config.enabled) {
        for (const name in mcpConfigs.value) {
          if (name !== mcpName && mcpConfigs.value[name].enabled) {
            mcpConfigs.value[name].enabled = false
          }
        }
      }
      
      // 准备MCP配置数据
      const enabledMcps = Object.entries(mcpConfigs.value)
        .filter(([_, config]) => config.enabled)
        .map(([name]) => name)
      
      const mcpConfigsData = Object.fromEntries(
        Object.entries(mcpConfigs.value).map(([name, config]) => [name, config.configs])
      )
      
      // 保存到服务器
      await mcpApi.updateUserMcps(enabledMcps, mcpConfigsData)
    } catch (error) {
      console.error('保存MCP配置失败:', error)
      throw error
    }
  }
  
  // 启用或禁用MCP
  async function toggleMcpEnabled(mcpName: string, enabled: boolean): Promise<void> {
    try {
      let config = mcpConfigs.value[mcpName]
      
      // 查找是否为内置MCP
      const isBuiltIn = mcps.value.some(mcp => mcp.name === mcpName)
      
      // 如果配置不存在或需要重置
      if (!config) {
        // 尝试从预设中查找
        const presetMcp = mcps.value.find(mcp => mcp.name === mcpName)
        
        if (presetMcp) {
          // 使用预设配置
          config = {
            enabled,
            configs: {
              desc: presetMcp.desc,
              command: presetMcp.command,
              args: [...presetMcp.args],
              env: presetMcp.env ? { ...presetMcp.env } : undefined
            }
          }
        } else {
          // 创建空配置
          config = {
            enabled,
            configs: {
              command: '',
              args: []
            }
          }
        }
      } else if (isBuiltIn) {
        // 对于内置MCP，如果启用，强制使用内置配置
        if (enabled) {
          const presetMcp = mcps.value.find(mcp => mcp.name === mcpName)
          if (presetMcp) {
            config = {
              enabled: true,
              configs: {
                desc: presetMcp.desc,
                command: presetMcp.command,
                args: [...presetMcp.args],
                env: presetMcp.env ? { ...presetMcp.env } : undefined
              }
            }
          }
        } else {
          // 如果禁用，只更新启用状态
          config = { ...config, enabled: false }
        }
      } else {
        // 对于自定义MCP，只更新启用状态
        config = { ...config, enabled }
      }
      
      // 保存配置
      await saveMcpConfig(mcpName, config)
    } catch (error) {
      console.error('切换MCP状态失败:', error)
      throw error
    }
  }
  
  // 更新MCP配置
  async function updateMcpConfig(mcpName: string, newConfig: Partial<McpConfig['configs']>): Promise<void> {
    try {
      // 检查是否为内置MCP
      const isBuiltIn = mcps.value.some(mcp => mcp.name === mcpName)
      if (isBuiltIn) {
        console.warn(`不能修改内置MCP '${mcpName}' 的配置`)
        return
      }
      
      const config = mcpConfigs.value[mcpName] || { 
        enabled: false, 
        configs: { command: '', args: [] } 
      }
      
      // 更新配置
      config.configs = {
        ...config.configs,
        ...newConfig
      }
      
      // 保存配置
      await saveMcpConfig(mcpName, config)
    } catch (error) {
      console.error('更新MCP配置失败:', error)
      throw error
    }
  }
  
  // 添加自定义MCP
  async function addCustomMcp(name: string, mcpConfig: Partial<McpConfig['configs']>): Promise<void> {
    try {
      // 验证名称唯一性
      if (mcpConfigs.value[name]) {
        throw new Error(`MCP '${name}' 已存在`)
      }
      
      // 创建新的MCP配置
      const config: McpConfig = {
        enabled: true,
        configs: {
          command: mcpConfig.command || '',
          args: mcpConfig.args || [],
          desc: mcpConfig.desc,
          env: mcpConfig.env
        }
      }
      
      // 保存配置
      await saveMcpConfig(name, config)
    } catch (error) {
      console.error('添加自定义MCP失败:', error)
      throw error
    }
  }
  
  // 初始化MCP配置
  async function initialize() {
    // 防止重复初始化
    if (initialized.value || isLoading.value) {
      return;
    }
    
    isLoading.value = true;
    console.log('初始化MCP配置...');
    
    try {
      // 1. 先获取后端支持的所有MCP
      const mcpsResponse = await mcpApi.getAllMcps()
      if (mcpsResponse.data) {
        // 将API返回的MCP转换为本地MCP对象
        mcps.value = mcpsResponse.data
      }
      
      // 2. 获取用户已启用的MCP配置
      const userMcpsResponse = await mcpApi.getUserMcps()
      if (userMcpsResponse.data) {
        const { enabledMcps: userEnabledMcps, mcpConfigs: userMcpConfigs } = userMcpsResponse.data
        
        // 初始化每个MCP的配置
        // 先添加内置MCP
        for (const mcp of mcps.value) {
          const isEnabled = userEnabledMcps.includes(mcp.name)
          const configs = userMcpConfigs[mcp.name] || {
            command: mcp.command,
            args: mcp.args,
            desc: mcp.desc,
            env: mcp.env
          }
          
          mcpConfigs.value[mcp.name] = {
            enabled: isEnabled,
            configs
          }
        }
        
        // 再添加用户自定义MCP
        for (const mcpName of userEnabledMcps) {
          if (!mcpConfigs.value[mcpName] && userMcpConfigs[mcpName]) {
            mcpConfigs.value[mcpName] = {
              enabled: true,
              configs: userMcpConfigs[mcpName]
            }
          }
        }
      }
      
      initialized.value = true;
      console.log('MCP配置初始化完成');
    } catch (error) {
      console.error('初始化MCP配置失败:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  return {
    allMcps,
    enabledMcps,
    activeMcp,
    mcpConfigs,
    isLoading,
    initialized,
    isMcpAvailable,
    toggleMcpEnabled,
    updateMcpConfig,
    addCustomMcp,
    initialize
  }
}) 