<template>
  <div class="modal-backdrop" v-if="isOpen" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>工具管理</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="tools-list">
          <div 
            v-for="tool in toolsStore.allTools" 
            :key="tool.name"
            class="tool-item"
          >
            <div class="tool-header">
              <div class="tool-title">
                <label :for="'tool-' + tool.name" class="tool-name">
                  <input 
                    :id="'tool-' + tool.name" 
                    type="checkbox" 
                    :checked="getToolConfig(tool.name)?.enabled"
                    :disabled="!isToolAvailable(tool.name) && tool.configRequired && tool.configRequired.length > 0"
                    @change="toggleTool(tool.name, $event)"
                  />
                  {{ tool.name }}
                </label>
                <span class="tool-description">{{ tool.description }}</span>
              </div>
              <button 
                class="expand-btn" 
                @click="toggleExpanded(tool.name)"
                v-if="tool.configRequired && tool.configRequired.length > 0"
              >
                <span class="icon">
                  <SvgIcon :name="expandedTools.includes(tool.name) ? 'chevron-up' : 'chevron-down'" :size="16" />
                </span>
              </button>
            </div>
            
            <div class="tool-config" v-if="expandedTools.includes(tool.name) && tool.configRequired">
              <div 
                v-for="configKey in tool.configRequired" 
                :key="configKey"
                class="config-item"
              >
                <label :for="'config-' + tool.name + '-' + configKey">{{ configKey }}</label>
                <input 
                  :id="'config-' + tool.name + '-' + configKey" 
                  type="text" 
                  :value="getToolConfig(tool.name)?.configs[configKey] || ''"
                  @input="updateToolConfig(tool.name, configKey, $event)"
                  placeholder="请输入配置值"
                />
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
import { ref, onMounted } from 'vue'
import { useToolsStore } from '@/stores/tools'
import SvgIcon from '@/components/common/SvgIcon.vue'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toolsStore = useToolsStore()
const isLoading = ref(false)
const expandedTools = ref<string[]>([])

// 获取工具配置
function getToolConfig(toolName: string) {
  return toolsStore.toolConfigs[toolName]
}

// 检查工具是否可用（配置完整）
function isToolAvailable(toolName: string): boolean {
  return toolsStore.isToolAvailable(toolName)
}

// 切换工具展开状态
function toggleExpanded(toolName: string): void {
  if (expandedTools.value.includes(toolName)) {
    expandedTools.value = expandedTools.value.filter(name => name !== toolName)
  } else {
    expandedTools.value.push(toolName)
  }
}

// 切换工具启用状态
function toggleTool(toolName: string, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked
  
  // 如果工具需要配置但未展开，则自动展开
  if (checked) {
    const tool = toolsStore.allTools.find(t => t.name === toolName)
    if (tool?.configRequired && tool.configRequired.length > 0 && !expandedTools.value.includes(toolName)) {
      expandedTools.value.push(toolName)
    }
  }
  
  toolsStore.toggleToolEnabled(toolName, checked)
}

// 更新工具配置
function updateToolConfig(toolName: string, configKey: string, event: Event): void {
  const value = (event.target as HTMLInputElement).value
  toolsStore.setToolConfigItem(toolName, configKey, value)
}

// 保存设置
async function saveSettings(): Promise<void> {
  isLoading.value = true
  try {
    await toolsStore.initialize()
    closeModal()
  } catch (error) {
    console.error('保存工具配置失败:', error)
    alert('保存工具配置失败，请重试。')
  } finally {
    isLoading.value = false
  }
}

// 关闭模态窗
function closeModal(): void {
  emit('close')
}

onMounted(async () => {
  // 初始化工具配置
  await toolsStore.initialize()
  
  // 默认展开所有需要配置且已启用的工具
  for (const tool of toolsStore.allTools) {
    const config = getToolConfig(tool.name)
    if (config?.enabled && tool.configRequired && tool.configRequired.length > 0) {
      expandedTools.value.push(tool.name)
    }
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
  max-height: 80vh;
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
  flex: 1;
  overflow-y: auto;
  
  .tools-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    
    .tool-item {
      border: 1px solid #e5e5e5;
      border-radius: 4px;
      overflow: hidden;
      
      .tool-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background-color: #f9f9f9;
        cursor: pointer;
        
        .tool-title {
          display: flex;
          flex-direction: column;
          gap: 4px;
          
          .tool-name {
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            
            input {
              cursor: pointer;
            }
          }
          
          .tool-description {
            font-size: 13px;
            color: #666;
          }
        }
        
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
      
      .tool-config {
        padding: 16px;
        background-color: #fff;
        border-top: 1px solid #e5e5e5;
        
        .config-item {
          margin-bottom: 12px;
          
          &:last-child {
            margin-bottom: 0;
          }
          
          label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
          }
          
          input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            
            &:focus {
              border-color: var(--primary-color);
              outline: none;
            }
          }
        }
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