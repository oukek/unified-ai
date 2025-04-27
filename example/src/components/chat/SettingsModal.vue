<template>
  <div class="modal-backdrop" v-if="isOpen" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3>API设置</h3>
        <button class="close-btn" @click="closeModal">×</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label for="gemini-api-key">Gemini API Key</label>
          <div class="input-wrapper">
            <input 
              :type="showApiKey ? 'text' : 'password'" 
              id="gemini-api-key" 
              v-model="apiKeyInput"
              placeholder="请输入您的Gemini API Key"
            />
            <button 
              class="toggle-visibility" 
              @click="toggleApiKeyVisibility"
              :title="showApiKey ? '隐藏' : '显示'"
            >
              <SvgIcon :name="showApiKey ? 'eye' : 'eye-off'" :size="18" />
            </button>
          </div>
          <p class="help-text">您的API密钥将会存储在服务器上。</p>
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
import { useSettingsStore } from '@/stores/settings'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { showError, showSuccess } from '@/utils/toast'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const settingsStore = useSettingsStore()
const apiKeyInput = ref('')
const showApiKey = ref(false)
const isLoading = ref(false)

onMounted(async () => {
  // 初始化设置
  if (!settingsStore.initialized) {
    await settingsStore.initialize()
  }
  apiKeyInput.value = settingsStore.geminiApiKey
})

function closeModal() {
  emit('close')
}

function toggleApiKeyVisibility() {
  showApiKey.value = !showApiKey.value
}

async function saveSettings() {
  isLoading.value = true
  try {
    await settingsStore.saveGeminiApiKey(apiKeyInput.value)
    showSuccess('API Key 保存成功')
    closeModal()
  } catch (error) {
    console.error('保存设置失败:', error)
    showError('保存设置失败，请重试')
  } finally {
    isLoading.value = false
  }
}
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
  width: 450px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
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
  
  .form-group {
    margin-bottom: 16px;
    
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      font-size: 14px;
    }
    
    .input-wrapper {
      position: relative;
      display: flex;
      
      input {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        transition: border-color 0.2s;
        
        &:focus {
          outline: none;
          border-color: var(--primary-color);
        }
      }
      
      .toggle-visibility {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        cursor: pointer;
        color: #888;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        
        &:hover {
          color: #333;
        }
      }
    }
    
    .help-text {
      margin-top: 8px;
      font-size: 12px;
      color: #888;
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