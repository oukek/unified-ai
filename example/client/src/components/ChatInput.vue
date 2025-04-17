<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chatStore'

// Define emits
const emit = defineEmits(['send-message'])

// Get the chat store
const chatStore = useChatStore()

// 用户输入
const userInput = ref('')

// 发送消息
const sendMessage = () => {
  if (!userInput.value.trim() || chatStore.loading) return
  emit('send-message', userInput.value)
  userInput.value = ''
}

// 输入框自动调整大小
const resizeTextarea = (event: Event) => {
  const textarea = event.target as HTMLTextAreaElement

  // 重置高度以便重新计算
  textarea.style.height = 'auto'

  // 计算新高度，但设置最大行数限制
  const lineHeight = parseInt(getComputedStyle(textarea).lineHeight)
  const maxHeight = lineHeight * 4 // 最多显示4行

  // 计算实际高度并应用限制
  const newHeight = Math.min(textarea.scrollHeight, maxHeight)
  textarea.style.height = `${newHeight}px`
}
</script>

<template>
  <div class="input-container">
    <div class="input-options">
      <!-- 会话信息 -->
      <span v-if="chatStore.currentHistoryId" class="session-info">
        <span class="session-icon">💬</span>
        <span>当前会话已保存</span>
      </span>
    </div>
    <div class="input-box">
      <textarea
        v-model="userInput"
        placeholder="输入消息..."
        @keydown.enter="(event) => {
          if (event.shiftKey) {
            // Shift+Enter 时阻止默认行为，并发送消息
            event.preventDefault();
            sendMessage();
            return;
          } else {
            // 仅 Enter 键时不阻止默认行为，允许换行
          }
        }"
        @input="resizeTextarea"
        :disabled="chatStore.loading"
        rows="1"
      ></textarea>
      <button
        @click="sendMessage"
        :disabled="!userInput.trim() || chatStore.loading"
        class="send-button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"></path>
        </svg>
      </button>
    </div>
    <div class="input-footer">
      <span>按 Enter 键发送，Shift+Enter 换行</span>
    </div>
  </div>
</template>

<style scoped>
.input-container {
  padding: 10px 20px 20px;
  background-color: white;
  border-top: 1px solid #e5e5e5;
}

.input-options {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.session-info {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #10a37f;
  margin-left: auto;
}

.session-icon {
  margin-right: 5px;
}

.input-box {
  display: flex;
  background-color: white;
  border: 1px solid #d9d9e3;
  border-radius: 8px;
  padding: 8px 12px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}

.input-box textarea {
  flex: 1;
  border: none;
  resize: none;
  outline: none;
  font-size: 16px;
  font-family: inherit;
  padding: 6px;
  line-height: 1.4;
  overflow-y: auto;
  min-height: 38px;
  max-height: calc(1.4em * 4 + 12px);
}

.send-button {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #10a37f;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-button:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.input-footer {
  text-align: center;
  font-size: 12px;
  color: #888;
  margin-top: 8px;
}
</style>
