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
              @click.stop="openDeleteConfirm(conversation.id)"
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
        <button class="mcp-btn" @click="showMcpsModal = true">
          <span class="icon">
            <SvgIcon name="code" :size="16" color="#666" />
          </span>
          <span>MCP</span>
        </button>
      </div>
      
      <button class="settings-btn" @click="showSettingsModal = true">
        <span class="icon">
          <SvgIcon name="settings" :size="16" color="#666" />
        </span>
        <span>模型设置</span>
      </button>
      
      <div class="user-profile" v-if="userStore.isLoggedIn">
        <div class="user-avatar">
          <SvgIcon name="user" :size="28" color="#666" />
        </div>
        <div class="user-info">
          <div class="username">{{ userStore.currentUser?.username }}</div>
          <button class="logout-btn" @click="showLogoutConfirm = true">
            退出登录
          </button>
        </div>
      </div>
      
      <SettingsModal 
        :is-open="showSettingsModal" 
        @close="showSettingsModal = false" 
      />
      <ToolsModal
        :is-open="showToolsModal"
        @close="showToolsModal = false"
      />
      <McpsModal
        :is-open="showMcpsModal"
        @close="showMcpsModal = false"
      />
    </div>
    
    <!-- 自定义确认对话框 -->
    <ConfirmDialog
      :is-open="showDeleteConfirm"
      title="删除会话"
      message="确定要删除这个会话吗？此操作无法撤销。"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
    
    <!-- 退出登录确认对话框 -->
    <ConfirmDialog
      :is-open="showLogoutConfirm"
      title="退出登录"
      message="确定要退出登录吗？"
      confirm-text="退出"
      cancel-text="取消"
      @confirm="logout"
      @cancel="() => showLogoutConfirm = false"
    />
  </aside>
</template>

<script setup lang="ts">
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import SettingsModal from './SettingsModal.vue'
import SvgIcon from '@/components/common/SvgIcon.vue'
import ToolsModal from './ToolsModal.vue'
import McpsModal from './McpsModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn')

const showSettingsModal = ref(false)
const showToolsModal = ref(false)
const showMcpsModal = ref(false)
const showLogoutConfirm = ref(false)
const chatStore = useChatStore()
const userStore = useUserStore()
const { conversations, activeConversationId } = storeToRefs(chatStore)
const hoveringId = ref<string | null>(null)

// 确认对话框相关
const showDeleteConfirm = ref(false)
const conversationToDelete = ref<string | null>(null)

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

// 打开删除确认对话框
function openDeleteConfirm(id: string) {
  conversationToDelete.value = id
  showDeleteConfirm.value = true
}

// 确认删除
function confirmDelete() {
  if (conversationToDelete.value) {
    chatStore.deleteConversation(conversationToDelete.value)
    showDeleteConfirm.value = false
    conversationToDelete.value = null
  }
}

// 取消删除
function cancelDelete() {
  showDeleteConfirm.value = false
  conversationToDelete.value = null
}

// 退出登录
function logout() {
  userStore.logout()
  showLogoutConfirm.value = false
}

// 格式化日期
function formatDate(date: string | Date): string {
  const dateObj = dayjs(date)
  const now = dayjs()
  
  // 如果是今天，显示时间 HH:mm
  if (dateObj.isSame(now, 'day')) {
    return dateObj.format('HH:mm')
  }
  
  // 如果是昨天，显示"昨天"
  if (dateObj.isSame(now.subtract(1, 'day'), 'day')) {
    return '昨天'
  }
  
  // 否则显示日期 MM/DD
  return dateObj.format('MM/DD')
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
      margin-bottom: 16px;
      
      .tools-btn, .mcp-btn {
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
    
    .settings-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 10px;
      margin-bottom: 16px;
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
    
    .user-profile {
      display: flex;
      align-items: center;
      padding: 12px;
      background-color: #edf7ed;
      border-radius: 8px;
      
      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background-color: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
      }
      
      .user-info {
        flex: 1;
        overflow: hidden;
        
        .username {
          font-weight: 600;
          margin-bottom: 4px;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .logout-btn {
          background: none;
          border: none;
          color: #f44336;
          font-size: 12px;
          padding: 0;
          cursor: pointer;
          text-decoration: underline;
          
          &:hover {
            color: darken(#f44336, 10%);
          }
        }
      }
    }
  }
}
</style> 