<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chatStore'

// Get the chat store
const chatStore = useChatStore()

// Show system message input area
const showSystemMessageInput = ref(false)

// Chat container reference for scrolling
const emit = defineEmits(['scrollToTop'])

// Toggle system message input area
const toggleSystemMessageInput = () => {
  showSystemMessageInput.value = !showSystemMessageInput.value

  // If opening input area, scroll to top
  if (showSystemMessageInput.value) {
    emit('scrollToTop')
  }
}

// Save system message
const saveSystemMessage = async () => {
  const success = await chatStore.saveSystemMessage()
  if (success) {
    showSystemMessageInput.value = false
  }
}
</script>

<template>
  <div class="system-message-area">
    <div v-if="!showSystemMessageInput" class="system-message-collapsed" @click="toggleSystemMessageInput">
      <div class="system-message-header">
        <span class="system-icon">🔧</span>
        <span>{{ chatStore.systemMessage ? '已设置系统消息' : '点击设置系统消息' }}</span>
        <span class="toggle-icon">▼</span>
      </div>
    </div>
    <div v-else class="system-message-expanded">
      <div class="system-message-header">
        <span class="system-icon">🔧</span>
        <span>系统消息</span>
        <button @click="toggleSystemMessageInput" class="close-system-message">▲</button>
      </div>
      <div class="system-message-content">
        <p class="system-message-description">
          系统消息用于设置AI助手的行为和特性。它在每次对话中发送给AI，但对用户不可见。
        </p>
        <textarea
          v-model="chatStore.systemMessage"
          class="system-message-textarea"
          placeholder="输入系统消息内容..."
          rows="4"
        ></textarea>
        <div class="system-message-examples">
          <div class="examples-title">快速选择:</div>
          <div class="example-tags">
            <button class="example-tag" @click="chatStore.systemMessage = '你是一个专业的前端开发助手，擅长Vue、React和现代CSS。你的回答应该简洁、专业且包含代码示例。'">
              前端开发助手
            </button>
            <button class="example-tag" @click="chatStore.systemMessage = '你是一个英语学习助手，帮助用户提高英语水平。用户用中文提问时，你需要用中文回答；用户用英文提问时，你需要用简单易懂的英文回答，并解释难词。'">
              英语学习助手
            </button>
            <button class="example-tag" @click="chatStore.systemMessage = '你是一个数据分析专家，善于解读复杂数据，提供洞察和可视化建议。请使用专业、清晰的语言回答。'">
              数据分析专家
            </button>
            <button class="example-tag" @click="chatStore.systemMessage = '你是一个有效的会议记录员。请帮助用户总结要点、整理信息并突出关键决策。'">
              会议记录员
            </button>
          </div>
        </div>
        <div class="system-message-actions">
          <button class="cancel-button" @click="toggleSystemMessageInput">取消</button>
          <button class="save-button" @click="saveSystemMessage">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.system-message-area {
  margin: 0;
  padding: 0 20px;
}

.system-message-collapsed {
  background-color: #f8faff;
  border: 1px solid #d0e3ff;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  margin: 15px 0;
  transition: all 0.2s;
}

.system-message-collapsed:hover {
  background-color: #f0f7ff;
  border-color: #b8d4ff;
}

.system-message-header {
  display: flex;
  align-items: center;
  color: #4a6fa5;
  font-size: 14px;
}

.system-icon {
  margin-right: 8px;
}

.toggle-icon {
  margin-left: auto;
  font-size: 12px;
  color: #888;
}

.system-message-expanded {
  background-color: #f8faff;
  border: 1px solid #d0e3ff;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
}

.system-message-content {
  margin-top: 10px;
}

.system-message-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d0e3ff;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
  min-height: 100px;
  box-sizing: border-box;
  margin: 10px 0;
}

.system-message-description {
  margin-bottom: 10px;
  font-size: 14px;
  color: #666;
  line-height: 1.5;
}

.system-message-examples {
  margin-top: 15px;
}

.examples-title {
  font-weight: 500;
  margin-bottom: 10px;
  font-size: 14px;
  color: #333;
}

.example-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.example-tag {
  background-color: #eef4ff;
  border: 1px solid #d0e3ff;
  color: #4a6fa5;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.example-tag:hover {
  background-color: #d0e3ff;
}

.system-message-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.close-system-message {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #4a6fa5;
  margin-left: auto;
}

.cancel-button {
  padding: 8px 15px;
  background-color: transparent;
  border: 1px solid #d9d9e3;
  border-radius: 4px;
  cursor: pointer;
}

.save-button {
  padding: 8px 15px;
  background-color: #10a37f;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
</style>
