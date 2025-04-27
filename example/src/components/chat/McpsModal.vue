<template>
  <div class="modal-backdrop" v-if="isOpen" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>MCP设置</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <p class="desc">MCP(Model Context Protocol)是用于获取最新信息或与外部系统交互的工具</p>
        
        <div v-if="isLoading" class="loading">
          <span>加载中...</span>
        </div>
        
        <div v-else class="mcps-list">
          <!-- 内置MCP列表 -->
          <div class="section-header">
            <h4>内置MCP</h4>
            <p class="hint">选择一个MCP与AI模型一起使用</p>
          </div>
          <div class="mcp-items">
            <div v-for="mcp in mcpsStore.allMcps" :key="mcp.name" class="mcp-item">
              <div class="mcp-header" @click="toggleExpanded(mcp.name)">
                <div class="mcp-info">
                  <input 
                    type="radio" 
                    name="selected-mcp"
                    :id="'mcp-' + mcp.name" 
                    :checked="isMcpSelected(mcp.name)"
                    @change="selectMcp(mcp.name)"
                  />
                  <label :for="'mcp-' + mcp.name">{{ mcp.name }}</label>
                  <span class="built-in-badge">内置</span>
                  <span class="mcp-badge" v-if="isMcpAvailable(mcp.name)">
                    <SvgIcon name="check-circle" :size="14" color="#4caf50" />
                  </span>
                </div>
                <div class="mcp-actions">
                  <button class="expand-btn">
                    <SvgIcon 
                      :name="expandedMcps.includes(mcp.name) ? 'chevron-up' : 'chevron-down'" 
                      :size="16" 
                      color="#666" 
                    />
                  </button>
                </div>
              </div>
              <div class="mcp-desc" v-if="mcp.desc">{{ mcp.desc }}</div>
              <div class="mcp-config" v-if="expandedMcps.includes(mcp.name)">
                <div class="config-info">
                  <div class="info-item">
                    <span class="info-label">命令：</span>
                    <span class="info-value">{{ mcp.command }}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">参数：</span>
                    <span class="info-value">{{ JSON.stringify(mcp.args) }}</span>
                  </div>
                  <div class="info-item" v-if="mcp.env">
                    <span class="info-label">环境变量：</span>
                    <span class="info-value">{{ JSON.stringify(mcp.env) }}</span>
                  </div>
                  <div class="info-note">
                    内置MCP配置不可编辑
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 自定义MCP表单 -->
          <div class="section-header">
            <h4>自定义MCP</h4>
          </div>
          <div class="custom-mcp-form">
            <div class="form-row">
              <div class="input-group">
                <label for="custom-mcp-name">名称</label>
                <input 
                  id="custom-mcp-name" 
                  type="text" 
                  v-model="customMcpForm.name"
                  placeholder="自定义MCP名称"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="custom-mcp-desc">描述 (可选)</label>
                <input 
                  id="custom-mcp-desc" 
                  type="text" 
                  v-model="customMcpForm.desc"
                  placeholder="描述信息"
                />
              </div>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="custom-mcp-command">命令</label>
                <input 
                  id="custom-mcp-command" 
                  type="text" 
                  v-model="customMcpForm.command"
                  placeholder="如: npx"
                  required
                />
              </div>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="custom-mcp-args">参数 (JSON格式数组)</label>
                <input 
                  id="custom-mcp-args" 
                  type="text" 
                  v-model="customMcpForm.argsString"
                  placeholder="如: [&quot;-y&quot;, &quot;@package/name&quot;]"
                  required
                />
              </div>
            </div>
            <div class="form-row">
              <div class="input-group">
                <label for="custom-mcp-env">环境变量 (JSON格式对象，可选)</label>
                <input 
                  id="custom-mcp-env" 
                  type="text" 
                  v-model="customMcpForm.envString"
                  placeholder="如: {&quot;VAR&quot;: &quot;value&quot;}"
                />
              </div>
            </div>
            <div class="form-row">
              <button 
                class="add-btn" 
                @click="addCustomMcp"
                :disabled="!isCustomMcpFormValid"
              >
                添加
              </button>
            </div>
          </div>
          
          <!-- 用户自定义MCP列表 -->
          <div v-if="customMcps.length > 0" class="section-header">
            <h4>已添加的自定义MCP</h4>
          </div>
          <div v-if="customMcps.length > 0" class="mcp-items">
            <div v-for="mcpName in customMcps" :key="mcpName" class="mcp-item">
              <div class="mcp-header" @click="toggleExpanded(mcpName)">
                <div class="mcp-info">
                  <input 
                    type="radio" 
                    name="selected-mcp"
                    :id="'mcp-' + mcpName" 
                    :checked="isMcpSelected(mcpName)"
                    @change="selectMcp(mcpName)"
                  />
                  <label :for="'mcp-' + mcpName">{{ mcpName }}</label>
                  <span class="mcp-badge" v-if="isMcpAvailable(mcpName)">
                    <SvgIcon name="check-circle" :size="14" color="#4caf50" />
                  </span>
                </div>
                <div class="mcp-actions">
                  <button class="expand-btn">
                    <SvgIcon 
                      :name="expandedMcps.includes(mcpName) ? 'chevron-up' : 'chevron-down'" 
                      :size="16" 
                      color="#666" 
                    />
                  </button>
                </div>
              </div>
              <div class="mcp-desc" v-if="getMcpConfig(mcpName)?.configs.desc">
                {{ getMcpConfig(mcpName)?.configs.desc }}
              </div>
              <div class="mcp-config" v-if="expandedMcps.includes(mcpName)">
                <div class="config-item">
                  <div class="config-label">
                    <label :for="'config-' + mcpName + '-command'">命令</label>
                  </div>
                  <input 
                    :id="'config-' + mcpName + '-command'" 
                    type="text" 
                    :value="getMcpConfig(mcpName)?.configs.command"
                    @input="updateMcpConfigField(mcpName, 'command', $event)"
                    placeholder="命令"
                  />
                </div>
                <div class="config-item">
                  <div class="config-label">
                    <label :for="'config-' + mcpName + '-args'">参数 (JSON格式数组)</label>
                  </div>
                  <input 
                    :id="'config-' + mcpName + '-args'" 
                    type="text" 
                    :value="getArgsString(mcpName)"
                    @input="updateMcpArgs(mcpName, $event)"
                    placeholder="参数 (如: [&quot;-y&quot;, &quot;@package/name&quot;])"
                  />
                </div>
                <div class="config-item">
                  <div class="config-label">
                    <label :for="'config-' + mcpName + '-env'">环境变量 (JSON格式对象，可选)</label>
                  </div>
                  <input 
                    :id="'config-' + mcpName + '-env'" 
                    type="text" 
                    :value="getEnvString(mcpName)"
                    @input="updateMcpEnv(mcpName, $event)"
                    placeholder="环境变量 (如: {&quot;VAR&quot;: &quot;value&quot;})"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="cancel-btn" @click="closeModal">取消</button>
        <button 
          class="save-btn" 
          @click="saveSettings"
          :disabled="isLoading"
        >
          {{ isLoading ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMcpsStore } from '@/stores/mcps'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { showError, showSuccess } from '@/utils/toast'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const mcpsStore = useMcpsStore()
const isLoading = ref(false)
const expandedMcps = ref<string[]>([])

// 选中的MCP（单选）
const selectedMcp = ref<string | null>(null)

// 自定义MCP表单
const customMcpForm = ref({
  name: '',
  desc: '',
  command: '',
  argsString: '',
  envString: ''
})

// 获取用户自定义的MCP列表
const customMcps = computed(() => {
  const builtInMcpNames = mcpsStore.allMcps.map(mcp => mcp.name)
  return Object.keys(mcpsStore.mcpConfigs)
    .filter(name => !builtInMcpNames.includes(name))
})

// 验证自定义MCP表单是否有效
const isCustomMcpFormValid = computed(() => {
  const { name, command, argsString } = customMcpForm.value
  
  // 验证名称、命令和参数都非空
  if (!name.trim() || !command.trim() || !argsString.trim()) {
    return false
  }
  
  // 验证JSON格式
  try {
    if (argsString.trim()) {
      const args = JSON.parse(argsString.trim())
      if (!Array.isArray(args)) {
        return false
      }
    }
    
    if (customMcpForm.value.envString.trim()) {
      const env = JSON.parse(customMcpForm.value.envString.trim())
      if (typeof env !== 'object' || Array.isArray(env)) {
        return false
      }
    }
    
    return true
  } catch (error) {
    return false
  }
})

// 获取MCP配置
function getMcpConfig(mcpName: string) {
  return mcpsStore.mcpConfigs[mcpName]
}

// 检查MCP是否为内置MCP
function isBuiltInMcp(mcpName: string): boolean {
  return mcpsStore.allMcps.some(mcp => mcp.name === mcpName)
}

// 检查MCP是否启用
function isMcpEnabled(mcpName: string): boolean {
  return !!getMcpConfig(mcpName)?.enabled
}

// 检查MCP是否可用（配置完整）
function isMcpAvailable(mcpName: string): boolean {
  return mcpsStore.isMcpAvailable(mcpName)
}

// 获取参数字符串表示
function getArgsString(mcpName: string): string {
  const config = getMcpConfig(mcpName)
  if (!config) return '[]'
  
  try {
    return JSON.stringify(config.configs.args || [])
  } catch (error) {
    return '[]'
  }
}

// 获取环境变量字符串表示
function getEnvString(mcpName: string): string {
  const config = getMcpConfig(mcpName)
  if (!config || !config.configs.env) return ''
  
  try {
    return JSON.stringify(config.configs.env || {})
  } catch (error) {
    return '{}'
  }
}

// 切换MCP展开状态
function toggleExpanded(mcpName: string): void {
  if (expandedMcps.value.includes(mcpName)) {
    expandedMcps.value = expandedMcps.value.filter(name => name !== mcpName)
  } else {
    expandedMcps.value.push(mcpName)
  }
}

// 更新MCP配置字段
function updateMcpConfigField(mcpName: string, field: string, event: Event): void {
  // 如果是内置MCP，不允许编辑
  if (isBuiltInMcp(mcpName)) {
    showError('内置MCP配置不可编辑')
    return
  }
  
  const value = (event.target as HTMLInputElement).value
  mcpsStore.updateMcpConfig(mcpName, { [field]: value })
}

// 更新MCP参数配置
function updateMcpArgs(mcpName: string, event: Event): void {
  // 如果是内置MCP，不允许编辑
  if (isBuiltInMcp(mcpName)) {
    showError('内置MCP配置不可编辑')
    return
  }
  
  const value = (event.target as HTMLInputElement).value
  
  try {
    const args = JSON.parse(value)
    if (Array.isArray(args)) {
      mcpsStore.updateMcpConfig(mcpName, { args })
    }
  } catch (error) {
    console.error('解析参数JSON失败:', error)
  }
}

// 更新MCP环境变量配置
function updateMcpEnv(mcpName: string, event: Event): void {
  // 如果是内置MCP，不允许编辑
  if (isBuiltInMcp(mcpName)) {
    showError('内置MCP配置不可编辑')
    return
  }
  
  const value = (event.target as HTMLInputElement).value
  
  try {
    if (!value.trim()) {
      // 如果为空，则清除环境变量配置
      mcpsStore.updateMcpConfig(mcpName, { env: undefined })
      return
    }
    
    const env = JSON.parse(value)
    if (typeof env === 'object' && !Array.isArray(env)) {
      mcpsStore.updateMcpConfig(mcpName, { env })
    }
  } catch (error) {
    console.error('解析环境变量JSON失败:', error)
  }
}

// 添加自定义MCP
async function addCustomMcp(): Promise<void> {
  if (!isCustomMcpFormValid.value) {
    showError('表单填写有误，请检查')
    return
  }
  
  try {
    const { name, desc, command } = customMcpForm.value
    const args = JSON.parse(customMcpForm.value.argsString)
    const env = customMcpForm.value.envString ? JSON.parse(customMcpForm.value.envString) : undefined
    
    await mcpsStore.addCustomMcp(name, { desc, command, args, env })
    
    // 清空表单
    customMcpForm.value = {
      name: '',
      desc: '',
      command: '',
      argsString: '',
      envString: ''
    }
    
    showSuccess('自定义MCP添加成功')
  } catch (error) {
    console.error('添加自定义MCP失败:', error)
    showError(error instanceof Error ? error.message : '添加自定义MCP失败')
  }
}

// 检查MCP是否被选中
function isMcpSelected(mcpName: string): boolean {
  return mcpName === selectedMcp.value
}

// 选择MCP
function selectMcp(mcpName: string): void {
  // 如果MCP未展开，则自动展开
  if (!expandedMcps.value.includes(mcpName)) {
    expandedMcps.value.push(mcpName)
  }
  
  // 更新选中的MCP
  selectedMcp.value = mcpName
  
  // 确保这个MCP是启用的
  if (!isMcpEnabled(mcpName)) {
    // 将之前所有的MCP禁用
    for (const mcpName of mcpsStore.enabledMcps) {
      mcpsStore.toggleMcpEnabled(mcpName, false)
    }
    
    // 启用新选择的MCP
    mcpsStore.toggleMcpEnabled(mcpName, true)
  }
}

// 保存设置
async function saveSettings(): Promise<void> {
  isLoading.value = true
  try {
    // 确保只有一个MCP启用
    const enabledMcpNames = mcpsStore.enabledMcps
    if (enabledMcpNames.length > 1 && selectedMcp.value) {
      // 先禁用所有MCP
      for (const mcpName of enabledMcpNames) {
        if (mcpName !== selectedMcp.value) {
          await mcpsStore.toggleMcpEnabled(mcpName, false)
        }
      }
    } else if (enabledMcpNames.length === 0 && selectedMcp.value) {
      // 如果没有启用的MCP但有选中的MCP，则启用它
      await mcpsStore.toggleMcpEnabled(selectedMcp.value, true)
    }
    
    showSuccess('MCP配置保存成功')
    closeModal()
  } catch (error) {
    console.error('保存MCP配置失败:', error)
    showError('保存MCP配置失败，请重试')
  } finally {
    isLoading.value = false
  }
}

// 关闭模态窗
function closeModal(): void {
  emit('close')
}

onMounted(async () => {
  // 初始化MCP配置
  if (!mcpsStore.initialized) {
    await mcpsStore.initialize()
  }
  
  // 默认选择第一个启用的MCP（如果有）
  const enabledMcps = mcpsStore.enabledMcps
  if (enabledMcps.length > 0) {
    selectedMcp.value = enabledMcps[0]
  }
  
  // 默认展开所有已启用的MCP
  for (const mcpName of mcpsStore.enabledMcps) {
    expandedMcps.value.push(mcpName)
  }
})
</script>

<style lang="less" scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 600px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: #888;
    
    &:hover {
      color: #333;
    }
  }
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  
  .desc {
    margin-bottom: 16px;
    color: #666;
    font-size: 14px;
  }
  
  .loading {
    padding: 20px;
    text-align: center;
    color: #666;
  }
}

.section-header {
  margin: 16px 0 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  
  h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
  
  .hint {
    font-size: 12px;
    color: #888;
  }
}

.mcps-list {
  .mcp-items {
    margin-bottom: 20px;
  }
  
  .mcp-item {
    border: 1px solid #eee;
    border-radius: 4px;
    margin-bottom: 8px;
    overflow: hidden;
    
    .mcp-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: #f9f9f9;
      cursor: pointer;
      
      .mcp-info {
        display: flex;
        align-items: center;
        gap: 8px;
        
        label {
          margin: 0;
          font-weight: 500;
          cursor: pointer;
        }
        
        .built-in-badge {
          font-size: 12px;
          background-color: #e1f5e1;
          color: var(--primary-color);
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;
        }
        
        .mcp-badge {
          display: flex;
          align-items: center;
        }
      }
      
      .mcp-actions {
        .expand-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: #666;
          display: flex;
          align-items: center;
          justify-content: center;
          
          &:hover {
            color: #333;
          }
        }
      }
    }
    
    .mcp-desc {
      padding: 0 16px 12px;
      font-size: 14px;
      color: #666;
    }
    
    .mcp-config {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      background-color: #fafafa;
      
      .config-item {
        margin-bottom: 12px;
        
        &:last-child {
          margin-bottom: 0;
        }
        
        .config-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          
          label {
            font-size: 14px;
            font-weight: 400;
          }
        }
        
        input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          
          &:focus {
            outline: none;
            border-color: var(--primary-color);
          }
        }
      }
      
      .config-info {
        background-color: #f5f5f5;
        border-radius: 4px;
        padding: 12px;
        
        .info-item {
          margin-bottom: 8px;
          font-size: 14px;
          display: flex;
          
          .info-label {
            font-weight: 500;
            min-width: 80px;
            color: #666;
          }
          
          .info-value {
            flex: 1;
            word-break: break-all;
            font-family: monospace;
            background-color: #eee;
            padding: 2px 4px;
            border-radius: 2px;
          }
        }
        
        .info-note {
          margin-top: 8px;
          font-size: 12px;
          color: #888;
          font-style: italic;
          text-align: center;
        }
      }
    }
  }
}

.custom-mcp-form {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 20px;
  
  .form-row {
    margin-bottom: 12px;
    
    &:last-child {
      margin-bottom: 0;
      display: flex;
      justify-content: flex-end;
    }
    
    .input-group {
      width: 100%;
      
      label {
        display: block;
        margin-bottom: 4px;
        font-size: 14px;
      }
      
      input {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        
        &:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      }
    }
    
    .add-btn {
      padding: 8px 16px;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      
      &:hover {
        background-color: darken(#4caf50, 5%);
      }
      
      &:disabled {
        background-color: #ccc;
        cursor: not-allowed;
      }
    }
  }
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .cancel-btn {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    color: #333;
    
    &:hover {
      background-color: #eaeaea;
    }
  }
  
  .save-btn {
    background-color: var(--primary-color);
    border: 1px solid var(--primary-color);
    color: white;
    
    &:hover {
      background-color: darken(#4caf50, 5%);
    }
    
    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}
</style> 