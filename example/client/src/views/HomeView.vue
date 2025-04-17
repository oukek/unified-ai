<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ChatSidebar from '@/components/ChatSidebar.vue'
import SystemMessageArea from '@/components/SystemMessageArea.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import { useChatStore } from '@/stores/chatStore'

// Get the chat store
const chatStore = useChatStore()

// 自动滚动到底部
const chatContainer = ref<HTMLElement | null>(null)
const scrollToBottom = () => {
  setTimeout(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  }, 100)
}

// 滚动到顶部
const scrollToTop = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = 0
  }
}

onMounted(() => {
  // 初始化 Socket 连接和监听
  chatStore.initSocketConnection(scrollToBottom)

  // 获取历史记录列表
  chatStore.getHistoryList()
})

onUnmounted(() => {
  // 清理所有 Socket 事件和定时器
  chatStore.cleanupSocketEvents()
})
</script>

<template>
  <div class="chat-container">
    <!-- 使用新的侧边栏组件 -->
    <ChatSidebar />

    <!-- 主聊天区域 -->
    <div class="main-chat">
      <!-- 使用新的系统消息组件 -->
      <SystemMessageArea @scroll-to-top="scrollToTop" />

      <!-- 消息列表 -->
      <div class="messages-container" ref="chatContainer">
        <div v-if="chatStore.messages.length === 0" class="welcome-container">
          <div class="welcome-box">
            <h1>UnifiedAI 聊天</h1>
            <p>这是一个基于 UnifiedAI 的AI聊天应用</p>
          </div>
        </div>

        <div v-else class="message-list">
          <!-- 使用新的消息组件 -->
          <ChatMessage
            v-for="message in chatStore.messages"
            :key="message.id"
            :message="message"
          />
        </div>
      </div>

      <!-- 使用新的输入组件 -->
      <ChatInput
        @send-message="(text) => chatStore.sendMessage(text, scrollToBottom)"
      />
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100vh;
  width: 100%;
  background-color: #f7f7f8;
}

.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 0;
}

.welcome-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.welcome-box {
  text-align: center;
  max-width: 600px;
  padding: 40px;
}

.welcome-box h1 {
  margin-bottom: 10px;
  font-size: 2rem;
}

.message-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}
</style>
