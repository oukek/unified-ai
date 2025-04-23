<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <button class="new-chat-btn" @click="createNewChat">
        <span class="icon">
          <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
          </svg>
        </span>
        <span>新建会话</span>
      </button>
    </div>
    
    <div class="sidebar-content">
      <h3>最近会话</h3>
      <ul class="conversation-list">
        <li 
          v-for="conversation in conversations" 
          :key="conversation.id"
          :class="{ active: conversation.id === activeConversationId }"
          @click="setActiveConversation(conversation.id)"
          @mouseenter="showDeleteButton(conversation.id)"
          @mouseleave="hideDeleteButton()"
        >
          <div class="conversation-item">
            <span class="icon">
              <SvgIcon name="chat" :size="16" color="#666" />
            </span>
            <span class="title">{{ conversation.title }}</span>
            <span class="date">{{ formatDate(conversation.updatedAt) }}</span>
            <button 
              class="delete-btn" 
              @click.stop="handleDelete(conversation.id)"
              title="删除会话"
              :style="{ opacity: hoveringId === conversation.id ? 1 : 0 }"
            >
              <span class="icon">
                <SvgIcon name="trash" :size="16" :color="'#888'" />
              </span>
            </button>
          </div>
        </li>
      </ul>
    </div>
    
    <div class="sidebar-footer">
      <div class="footer-buttons">
        <button class="tools-btn" @click="showToolsModal = true">
          <span class="icon">
            <SvgIcon name="tool" :size="16" color="#666" />
          </span>
          <span>工具</span>
        </button>
        <button class="settings-btn" @click="showSettingsModal = true">
          <span class="icon">
            <SvgIcon name="settings" :size="16" color="#666" />
          </span>
          <span>设置</span>
        </button>
      </div>
      <SettingsModal 
        :is-open="showSettingsModal" 
        @close="showSettingsModal = false" 
      />
      <ToolsModal
        :is-open="showToolsModal"
        @close="showToolsModal = false"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores/chat'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import SettingsModal from './SettingsModal.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ToolsModal from './ToolsModal.vue'

const showSettingsModal = ref(false)
const showToolsModal = ref(false)
const chatStore = useChatStore()
const { conversations, activeConversationId } = storeToRefs(chatStore)
const hoveringId = ref<string | null>(null)

// 控制删除按钮显示
function showDeleteButton(id: string) {
  hoveringId.value = id
}

function hideDeleteButton() {
  hoveringId.value = null
}

// 创建新会话
function createNewChat() {
  chatStore.createConversation()
}

// 设置当前会话
function setActiveConversation(id: string) {
  chatStore.setActiveConversation(id)
}

// 处理删除会话
function handleDelete(id: string) {
  if (confirm('确定要删除这个会话吗？')) {
    chatStore.deleteConversation(id)
  }
}

// 格式化日期
function formatDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  // 如果是今天，显示时间
  if (diff < 24 * 60 * 60 * 1000 && 
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  
  // 如果是昨天，显示"昨天"
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()) {
    return '昨天'
  }
  
  // 否则显示日期
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
</script>

<style lang="less" scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 260px;
  height: 100%;
  background-color: #f7f7f8;
  border-right: 1px solid #e5e5e5;
  
  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #e5e5e5;
    
    .new-chat-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 10px;
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: darken(#4caf50, 5%);
      }
      
      .icon {
        margin-right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
      }
    }
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    
    h3 {
      font-size: 14px;
      color: #666;
      margin: 0 0 12px 0;
      font-weight: 500;
    }
    
    .conversation-list {
      list-style: none;
      padding: 0;
      margin: 0;
      
      li {
        margin-bottom: 8px;
        border-radius: 4px;
        transition: background-color 0.2s;
        
        &.active {
          background-color: #e1f5e1;
          
          .conversation-item {
            .title {
              font-weight: 600;
              color: var(--primary-color);
            }
          }
        }
        
        &:hover {
          background-color: #f0f0f0;
        }
      }
      
      .conversation-item {
        display: flex;
        align-items: center;
        padding: 10px;
        cursor: pointer;
        
        .icon {
          margin-right: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }
        
        .title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 14px;
        }
        
        .date {
          font-size: 12px;
          color: #888;
          margin-right: 8px;
        }
        
        .delete-btn {
          background: none;
          border: none;
          color: #888;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
          padding: 4px;
          
          &:hover {
            color: #ff5252;
          }
          
          .icon {
            display: flex;
            margin-right: 0;
            width: 20px;
            height: 20px;
            align-items: center;
            justify-content: center;
          }
        }
      }
    }
  }
  
  .sidebar-footer {
    padding: 16px;
    border-top: 1px solid #e5e5e5;
    
    .footer-buttons {
      display: flex;
      gap: 10px;
      
      .tools-btn, .settings-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding: 10px;
        background-color: #f0f0f0;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        
        &:hover {
          background-color: #e5e5e5;
        }
        
        .icon {
          margin-right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
        }
      }
    }
  }
}
</style> 