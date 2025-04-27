<template>
  <div :class="['message-item', `message-${message.role}`]">
    <div class="avatar">
      <div v-if="message.role === 'user'" class="user-avatar">
        <SvgIcon name="user" :size="20" color="#4caf50" />
      </div>
      <div v-else class="assistant-avatar">
        <SvgIcon name="robot" :size="20" color="#5178e7" />
      </div>
    </div>
    <div class="message-content">
      <div class="content-header">
        <span class="role-name">{{ message.role === 'user' ? '用户' : 'AI 助手' }}</span>
        <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
      </div>
      <!-- 用户消息使用原始内容渲染 -->
      <div v-if="message.role === 'user'" class="content-body" v-html="renderedContent"></div>
      
      <!-- AI消息始终使用blocks渲染 -->
      <div v-else class="content-body">
        <!-- 消息块渲染：始终使用blocks，无论是否为空或加载中 -->
        <div v-if="!((!message.blocks || message.blocks.length === 0) && !message.isLoading)" class="message-blocks">
          <!-- 根据块类型直接渲染相应组件 -->
          <template v-for="(block, index) in message.blocks" :key="index">
            <!-- 文本块 -->
            <TextBlock 
              v-if="block.type === 'text'" 
              :block="block"
              :isLoading="message.isLoading === true"
              @scrollToBottom="triggerScrollToBottom"
            />
            
            <!-- 工具调用块 -->
            <ToolBlock 
              v-else-if="block.type === 'tool'" 
              :block="block"
            />
          </template>
        </div>
              
        <!-- 打字指示器（仅在没有消息块但正在加载时显示） -->
        <div v-if="message.isLoading && (!message.blocks || message.blocks.length === 0)" class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { EnhancedChatMessage } from '@/types/chat'
import SvgIcon from '@/components/common/SvgIcon.vue'
import TextBlock from '@/components/chat/blocks/TextBlock.vue'
import ToolBlock from '@/components/chat/blocks/ToolBlock.vue'
import { computed, onMounted } from 'vue'
import 'highlight.js/styles/github.css' // 导入默认的 GitHub 风格样式
import { renderMarkdown } from '@/utils/markdown'
import { formatTime } from '@/utils/time'

const props = defineProps<{
  message: EnhancedChatMessage
}>()

// 自定义事件
const emit = defineEmits(['scrollToBottom'])

// 发送滚动到底部事件
function triggerScrollToBottom() {
  emit('scrollToBottom')
}

// 渲染 Markdown 内容（仅用于用户消息）
const renderedContent = computed(() => {
  if (props.message.role === 'user') {
    return renderMarkdown(props.message.content || '')
  }
  return ''
})

// 组件挂载时启动打字机效果
onMounted(() => {
  if (props.message.role === 'assistant' && props.message.isLoading === true) {
    // 确保触发一次滚动
    triggerScrollToBottom()
  }
})
</script>

<style lang="less" scoped>
.message-item {
  display: flex;
  padding: 16px 0;
  
  &.message-user {
    background-color: #fff;
  }
  
  &.message-assistant {
    background-color: #fff;
  }
  
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    flex-shrink: 0;
    
    .user-avatar {
      width: 36px;
      height: 36px;
      background-color: #e1f5e1;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-color);
      overflow: hidden;
    }
    
    .assistant-avatar {
      width: 36px;
      height: 36px;
      background-color: #e1eaff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #5178e7;
      overflow: hidden;
    }
  }
  
  .message-content {
    flex: 1;
    max-width: calc(100% - 56px);
    
    .content-header {
      display: flex;
      align-items: center;
      margin-bottom: 6px;
      
      .role-name {
        font-weight: 600;
        font-size: 14px;
      }
      
      .timestamp {
        margin-left: 10px;
        font-size: 12px;
        color: #888;
      }
    }
    
    .content-body {
      font-size: 15px;
      line-height: 1.6;
      word-break: break-word;
      
      :deep(p) {
        margin: 8px 0;
      }
      
      :deep(pre) {
        background-color: #f6f8fa;
        border-radius: 6px;
        padding: 12px;
        overflow: auto;
        margin: 10px 0;
      }
      
      :deep(code) {
        background-color: rgba(175, 184, 193, 0.2);
        border-radius: 4px;
        padding: 0.2em 0.4em;
        font-family: monospace;
      }
      
      :deep(pre code) {
        background-color: transparent;
        padding: 0;
      }
      
      :deep(a) {
        color: #0969da;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
      
      :deep(img) {
        max-width: 100%;
        border-radius: 4px;
      }
      
      :deep(blockquote) {
        border-left: 4px solid #dfe2e5;
        margin: 0;
        padding-left: 16px;
        color: #6a737d;
      }
      
      :deep(ul), :deep(ol) {
        padding-left: 2em;
      }
    }
    
    .typing-indicator {
      display: inline-flex;
      align-items: center;
      margin-left: 4px;
      
      span {
        width: 4px;
        height: 4px;
        margin: 0 1px;
        background-color: #767676;
        border-radius: 50%;
        display: inline-block;
        animation: typing 1.4s infinite ease-in-out both;
        
        &:nth-child(1) {
          animation-delay: 0s;
        }
        
        &:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }
    }
  }
}

@keyframes typing {
  0% {
    transform: scale(0);
  }
  20% {
    transform: scale(1);
  }
  50% {
    transform: scale(0);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style> 