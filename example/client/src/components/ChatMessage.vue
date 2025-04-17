<script setup lang="ts">
import { marked } from 'marked'
import type { Message } from '@/stores/chatStore'
import { computed } from 'vue'

// Define props
const props = defineProps<{
  message: Message
}>()

// 显示消息的ID，优先显示服务端ID
const displayId = computed(() => {
  return props.message.serverId || props.message.id
})

// 处理多余的换行符，将连续的换行符替换为单个换行符
const normalizeNewlines = (text: string): string => {
  // 使用更强的正则替换多余换行
  // return text.replace(/\n{2,}/g, '\n');
  return text;
}

// 安全地使用marked渲染markdown
const renderMarkdown = (text: string) => {
  try {
    // 处理多余的换行符
    const normalizedText = normalizeNewlines(text);
    return marked.parse(normalizedText);
  } catch (e) {
    console.error('Markdown渲染失败:', e);
    return text;
  }
}
</script>

<template>
  <div :class="['message', `message-${message.role}`]">
    <!-- 用户消息 -->
    <template v-if="message.role === 'user'">
      <div class="message-content user-content">
        <!-- 加载指示器 -->
        <p v-if="message.loading" class="loading-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </p>

        <!-- 用户消息内容 -->
        <div v-else class="user-message-text">
          {{ message.content }}
        </div>

        <!-- 错误信息 -->
        <div v-if="message.error" class="error-notice">
          <strong>错误:</strong> {{ message.errorMessage }}
        </div>

        <!-- 简洁的时间戳和元数据图标 -->
        <div v-if="message.timestamp" class="message-time">
          {{ new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
          <span v-if="message.chatId || message.serverId || message.id" class="meta-icon-wrapper">
            <span class="meta-icon">ⓘ</span>
            <div class="meta-popup">
              <div v-if="message.chatId" class="meta-popup-item">
                <span class="meta-label">聊天ID:</span> {{ message.chatId }}
              </div>
              <div v-if="message.serverId || message.id" class="meta-popup-item">
                <span class="meta-label">消息ID:</span> {{ displayId }}
              </div>
              <div v-if="message.timestamp" class="meta-popup-item">
                <span class="meta-label">时间:</span> {{ new Date(message.timestamp).toLocaleString() }}
              </div>
            </div>
          </span>
        </div>
      </div>
      <div class="message-avatar user-avatar-container">
        <div class="avatar user-avatar">U</div>
      </div>
    </template>

    <!-- AI和系统消息 -->
    <template v-else>
      <div class="message-avatar assistant-avatar-container">
        <div v-if="message.role === 'system'" class="avatar system-avatar">S</div>
        <div v-else class="avatar assistant-avatar">A</div>
      </div>
      <div class="message-content ai-content">
        <!-- 加载指示器 -->
        <p v-if="message.loading" class="loading-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </p>

        <!-- 系统消息使用Markdown渲染 -->
        <div v-else-if="message.role === 'system'" class="system-message-text" v-html="renderMarkdown(message.content)"></div>

        <!-- 助手回复使用分段显示 -->
        <div v-else class="segmented-content">
          <template v-for="(segment, index) in message.segments" :key="index">
            <!-- 文本段 -->
            <div v-if="segment.type === 'text'"
                 class="text-segment"
                 v-html="renderMarkdown(segment.content)"></div>

            <!-- 函数调用段 -->
            <div v-else-if="segment.type === 'function' && segment.functionCall"
                 class="function-segment">
              <div class="function-calls-container">
                <div class="function-calls-toggle"
                     @click="segment.functionCall.showDetails = !segment.functionCall.showDetails">
                  <span class="function-badge">
                    <span class="function-icon">🔧</span>
                    {{ segment.functionCall.name }}
                  </span>
                  <span class="toggle-icon">{{ segment.functionCall.showDetails ? '▼' : '▶' }}</span>
                </div>

                <div v-if="segment.functionCall.showDetails" class="function-calls">
                  <div class="function-calls-list">
                    <div class="function-call-item">
                      <div class="function-name">
                        <span>工具调用: {{ segment.functionCall.name }}</span>
                      </div>
                      <div class="function-args">
                        <div class="args-label">参数:</div>
                        <pre>{{ JSON.stringify(segment.functionCall.arguments, null, 2) }}</pre>
                      </div>
                      <div v-if="segment.functionCall.result" class="function-result">
                        <div class="result-label">结果:</div>
                        <div class="result-content"
                             v-html="renderMarkdown(typeof segment.functionCall.result === 'string' ?
                                                   segment.functionCall.result :
                                                   JSON.stringify(segment.functionCall.result, null, 2))"></div>
                      </div>
                      <div v-else-if="segment.functionCall.completed === false" class="function-waiting">
                        <div class="waiting-label">等待结果...</div>
                        <div class="waiting-indicator">
                          <span class="small-dot"></span>
                          <span class="small-dot"></span>
                          <span class="small-dot"></span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 错误信息 -->
        <div v-if="message.error" class="error-notice">
          <strong>错误:</strong> {{ message.errorMessage }}
        </div>

        <!-- 简洁的时间戳和元数据图标 -->
        <div v-if="message.timestamp" class="message-time">
          {{ new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }}
          <span v-if="message.model" class="model-tag">{{ message.model }}</span>
          <span v-if="message.chatId || message.serverId || message.id" class="meta-icon-wrapper">
            <span class="meta-icon">ⓘ</span>
            <div class="meta-popup">
              <div v-if="message.chatId" class="meta-popup-item">
                <span class="meta-label">聊天ID:</span> {{ message.chatId }}
              </div>
              <div v-if="message.serverId || message.id" class="meta-popup-item">
                <span class="meta-label">消息ID:</span> {{ displayId }}
              </div>
              <div v-if="message.timestamp" class="meta-popup-item">
                <span class="meta-label">时间:</span> {{ new Date(message.timestamp).toLocaleString() }}
              </div>
              <div v-if="message.model" class="meta-popup-item">
                <span class="meta-label">模型:</span> {{ message.model }}
              </div>
            </div>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 元数据图标样式 */
.meta-icon-wrapper {
  position: relative;
  display: inline-block;
  margin-left: 4px;
  cursor: pointer;
}

.meta-icon {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.4);
  transition: color 0.2s ease;
}

.meta-icon-wrapper:hover .meta-icon {
  color: rgba(0, 0, 0, 0.8);
}

.meta-popup {
  display: none;
  position: absolute;
  bottom: 18px;
  right: 0;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 6px;
  padding: 8px 10px;
  min-width: 200px;
  max-width: 250px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  z-index: 10;
  font-size: 11px;
  animation: popup-fade 0.2s ease;
}

.meta-popup::after {
  content: '';
  position: absolute;
  top: 100%;
  right: 5px;
  border-width: 5px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

.meta-icon-wrapper:hover .meta-popup {
  display: block;
}

.meta-popup-item {
  margin-bottom: 4px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-popup-item:last-child {
  margin-bottom: 0;
}

.meta-label {
  font-weight: bold;
  opacity: 0.8;
}

@keyframes popup-fade {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 其他基本样式保持不变 */
.message {
  display: flex;
  padding: 10px 20px;
  margin-bottom: 8px;
  align-items: flex-start;
  position: relative;
}

.message-user {
  flex-direction: row;
  justify-content: flex-end;
}

.message-assistant, .message-system {
  flex-direction: row;
  justify-content: flex-start;
}

.message-avatar {
  margin: 0 10px;
  flex-shrink: 0;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.user-avatar {
  background-color: #10a37f;
  color: white;
}

.assistant-avatar {
  background-color: #9b59b6;
  color: white;
}

.system-avatar {
  background-color: #4a6fa5;
  color: white;
}

.message-content {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 12px;
  position: relative;
  background-color: #f0f0f0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.user-content {
  background-color: #dcf8c6;
  border-top-right-radius: 4px;
  border-top-left-radius: 12px;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  margin-right: 5px;
}

.ai-content {
  background-color: #f0f0f5;
  margin-left: 5px;
  border-top-left-radius: 4px;
}

.message-system .message-content {
  background-color: #e3f0ff;
  margin-left: 5px;
  border-top-left-radius: 4px;
}

.user-message-text {
  white-space: pre-wrap;
}

.system-message-text {
  white-space: pre-wrap;
}

.segmented-content {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.text-segment {
  margin-bottom: 0.5em;
}

.text-segment:last-child {
  margin-bottom: 0;
}

.function-segment {
  margin: 0;
  width: 100%;
}

.function-calls-container {
  margin: 4px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e0e0e5;
  background-color: #f8f8fa;
}

.function-calls-toggle {
  background-color: #f0f0f5;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  color: #555;
  border-bottom: 1px solid #e0e0e5;
}

.function-calls {
  background-color: #f7f7f9;
  border-radius: 0 0 8px 8px;
}

.function-calls-list {
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 0.85rem;
}

.function-call-item {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px dashed #ddd;
}

.function-call-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.function-name {
  font-weight: bold;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  font-size: 0.9rem;
}

.function-icon {
  margin-right: 8px;
}

.function-args, .function-result {
  background-color: #fff;
  border-radius: 4px;
  padding: 8px;
  margin-bottom: 8px;
  overflow-x: auto;
  font-size: 0.8rem;
}

.function-args pre, .function-result pre {
  margin: 0;
  font-size: 0.8rem;
  white-space: pre-wrap;
}

.args-label, .result-label {
  font-weight: 500;
  margin-bottom: 4px;
  color: #666;
  font-size: 0.85rem;
}

.result-label {
  color: #10a37f;
}

.toggle-icon {
  font-size: 12px;
  color: #888;
}

.function-badge {
  display: flex;
  align-items: center;
  background-color: #e9e9ed;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
}

.function-waiting {
  padding: 8px;
  border-radius: 4px;
  background-color: #f0f0f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.waiting-label {
  color: #666;
  font-size: 0.85rem;
}

.waiting-indicator {
  display: flex;
  gap: 4px;
}

.small-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #888;
  animation: pulse 1.5s infinite ease-in-out;
}

.small-dot:nth-child(2) {
  animation-delay: 0.5s;
}

.small-dot:nth-child(3) {
  animation-delay: 1s;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #888;
  animation: pulse 1.5s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.5s;
}

.dot:nth-child(3) {
  animation-delay: 1s;
}

.error-notice {
  margin-top: 10px;
  padding: 8px;
  background-color: #fce8e6;
  border-radius: 4px;
  color: #d93025;
}

.user-avatar-container {
  margin-left: 5px;
}

.assistant-avatar-container {
  margin-right: 5px;
}

/* 简洁的时间戳样式 */
.message-time {
  font-size: 10px;
  color: rgba(0, 0, 0, 0.5);
  margin-top: 5px;
  text-align: right;
}

.model-tag {
  font-size: 10px;
  background-color: rgba(0, 0, 0, 0.05);
  padding: 1px 4px;
  border-radius: 3px;
  margin-left: 5px;
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
