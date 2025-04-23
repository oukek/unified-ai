<template>
  <div class="chat-conversation">
    <div v-if="conversation" class="conversation-container">
      <div class="conversation-header">
        <h2>{{ conversation.title }}</h2>
        <div class="header-actions">
          <button 
            class="system-message-button"
            @click="toggleSystemMessagePanel"
            :class="{ 'active': showSystemMessagePanel }"
          >
            <SvgIcon name="settings" :size="16" color="#666" />
            <span>系统消息</span>
          </button>
        </div>
      </div>
      
      <!-- 系统消息设置面板 -->
      <div v-if="showSystemMessagePanel" class="system-message-panel">
        <div class="panel-header">
          <h3>设置系统消息</h3>
          <span class="hint">系统消息可以用来设置AI助手的行为指南或提供背景信息</span>
        </div>
        <div class="panel-content">
          <textarea
            v-model="systemMessageText"
            placeholder="输入系统消息..."
            class="system-message-input"
            rows="4"
          ></textarea>
        </div>
        <div class="panel-footer">
          <button class="cancel-btn" @click="cancelSystemMessage">取消</button>
          <button class="save-btn" @click="saveSystemMessage">保存</button>
        </div>
      </div>
      
      <div class="messages-container" ref="messagesContainerRef">
        <div v-if="conversation.messages.length > 0" class="messages-list">
          <MessageItem 
            v-for="message in conversation.messages" 
            :key="message.id" 
            :message="message" 
            @scroll-to-bottom="() => scrollToBottom()"
          />
        </div>
        <div v-else class="empty-conversation">
          <div class="empty-content">
            <div class="icon">
              <SvgIcon name="chat" :size="48" color="#888" />
            </div>
            <h3>开始新的对话</h3>
            <p>输入消息开始与AI助手交流</p>
          </div>
        </div>
      </div>
      
      <div class="input-container">
        <MessageInput @send="handleSendMessage" />
        <div class="input-tips">
          提示: 按 Enter 发送, Shift+Enter 换行
        </div>
      </div>
    </div>
    
    <div v-else class="no-conversation">
      <div class="no-conversation-content">
        <div class="icon">
          <SvgIcon name="wave" :size="60" color="#888" />
        </div>
        <h2>欢迎使用AI聊天助手</h2>
        <p>点击左侧"新建会话"开始对话</p>
      </div>
    </div>

    <!-- 添加Toast提示 -->
    <Toast 
      v-model:visible="showToast" 
      :message="toastMessage"
      :type="toastType"
      :duration="3000"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import MessageItem from './MessageItem.vue'
import MessageInput from './MessageInput.vue'
import { useChatStore } from '@/stores/chat'
import { storeToRefs } from 'pinia'
import SvgIcon from '@/components/common/SvgIcon.vue'
import Toast from '@/components/common/Toast.vue'

const chatStore = useChatStore()
const { activeConversation } = storeToRefs(chatStore)

// Toast提示相关
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref<'info' | 'success' | 'error' | 'warning'>('info')

// 显示提示信息
function showMessage(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
}

const conversation = computed(() => activeConversation.value)
const messagesContainerRef = ref<HTMLElement | null>(null)

// 系统消息面板状态
const showSystemMessagePanel = ref(false)
const systemMessageText = ref('')

// 当会话改变时，更新系统消息文本
watch(() => conversation.value?.id, (newId) => {
  if (newId && conversation.value) {
    systemMessageText.value = conversation.value.systemMessage || ''
  }
}, { immediate: true })

// 切换系统消息面板
function toggleSystemMessagePanel() {
  showSystemMessagePanel.value = !showSystemMessagePanel.value
  if (showSystemMessagePanel.value && conversation.value) {
    systemMessageText.value = conversation.value.systemMessage || ''
  }
}

// 保存系统消息
function saveSystemMessage() {
  if (conversation.value) {
    chatStore.updateSystemMessage(conversation.value.id, systemMessageText.value)
    showSystemMessagePanel.value = false
  }
}

// 取消编辑系统消息
function cancelSystemMessage() {
  if (conversation.value) {
    systemMessageText.value = conversation.value.systemMessage || ''
  }
  showSystemMessagePanel.value = false
}

// 监听消息变化，自动滚动到底部
watch(() => conversation.value?.messages.length, () => {
  scrollToBottom()
}, { immediate: true })

// 监听单个消息的内容变化，也触发滚动
watch(() => {
  if (!conversation.value) return []
  return conversation.value.messages.map(m => m.content)
}, () => {
  scrollToBottom()
}, { deep: true })

// 监听会话变化，初始加载时强制滚动到底部
watch(() => conversation.value?.id, (newId) => {
  if (newId) {
    // 会话ID改变时，表示切换到了新会话，强制滚动到底部
    scrollToBottom(true)
  }
}, { immediate: true })

// 滚动到底部
function scrollToBottom(isInitialLoad = false) {
  nextTick(() => {
    if (messagesContainerRef.value) {
      // 检查用户是否在查看历史消息
      const container = messagesContainerRef.value
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
      
      const scrollAction = () => {
        container.scrollTop = container.scrollHeight
      }
      
      // 如果是初始加载、用户正在底部附近，或者有新消息到来，自动滚动
      if (isInitialLoad || isNearBottom || chatStore.isSending) {
        if (isInitialLoad) {
          // 初始加载时添加小延迟确保DOM完全渲染
          setTimeout(scrollAction, 100)
        } else {
          scrollAction()
        }
      }
    }
  })
}

// 挂载时滚动到底部
onMounted(() => {
  // 使用强制滚动模式，确保首次加载时滚动到底部
  scrollToBottom(true)
})

// 处理消息发送
async function handleSendMessage(content: string) {
  if (!conversation.value) return
  
  try {
    // 使用实际的AI流式响应方法
    await chatStore.sendMessageToAIStream(content)
  } catch (error) {
    console.error('发送消息失败:', error)
    
    // 显示错误提示
    if (error instanceof Error) {
      // 处理API密钥缺失错误
      if (error.message.includes('请先在设置中配置Gemini API密钥')) {
        showMessage('请先在设置中配置Gemini API密钥', 'error')
      } else {
        showMessage(`发送消息失败: ${error.message}`, 'error')
      }
    } else {
      showMessage('发送消息失败，请稍后重试', 'error')
    }
  }
}
</script>

<style lang="less" scoped>
.chat-conversation {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  
  .conversation-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    
    .conversation-header {
      padding: 16px 24px;
      border-bottom: 1px solid #e5e5e5;
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
        color: #333;
      }
      
      .header-actions {
        display: flex;
        gap: 8px;
        
        .system-message-button {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 14px;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;
          
          &:hover {
            background: #f5f5f5;
          }
          
          &.active {
            background: #f0f0f0;
            border-color: #ccc;
          }
        }
      }
    }
    
    .system-message-panel {
      padding: 16px 24px;
      background: #f9f9f9;
      border-bottom: 1px solid #e5e5e5;
      
      .panel-header {
        margin-bottom: 12px;
        
        h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 500;
          color: #333;
        }
        
        .hint {
          font-size: 12px;
          color: #888;
        }
      }
      
      .panel-content {
        margin-bottom: 12px;
        
        .system-message-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
          
          &:focus {
            outline: none;
            border-color: var(--primary-color, #4a7afe);
          }
        }
      }
      
      .panel-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        
        button {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        
        .cancel-btn {
          background: transparent;
          border: 1px solid #ddd;
          color: #666;
          
          &:hover {
            background: #f5f5f5;
          }
        }
        
        .save-btn {
          background: var(--primary-color, #4a7afe);
          border: 1px solid var(--primary-color, #4a7afe);
          color: white;
          
          &:hover {
            opacity: 0.9;
          }
        }
      }
    }
    
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 0 24px;
      
      .messages-list {
        padding: 16px 0;
      }
      
      .empty-conversation {
        display: flex;
        height: 100%;
        align-items: center;
        justify-content: center;
        
        .empty-content {
          text-align: center;
          padding: 32px;
          
          .icon {
            margin-bottom: 16px;
            display: flex;
            justify-content: center;
          }
          
          h3 {
            margin: 0 0 8px 0;
            font-size: 20px;
            color: #333;
          }
          
          p {
            margin: 0;
            color: #666;
          }
        }
      }
    }
    
    .input-container {
      padding: 16px 24px 24px;
      
      .input-tips {
        margin-top: 8px;
        font-size: 12px;
        color: #888;
        text-align: right;
      }
    }
  }
  
  .no-conversation {
    display: flex;
    height: 100%;
    align-items: center;
    justify-content: center;
    
    .no-conversation-content {
      text-align: center;
      padding: 32px;
      
      .icon {
        margin-bottom: 24px;
        display: flex;
        justify-content: center;
      }
      
      h2 {
        margin: 0 0 16px 0;
        font-size: 28px;
        color: #333;
      }
      
      p {
        margin: 0;
        font-size: 16px;
        color: #666;
      }
    }
  }
}
</style> 