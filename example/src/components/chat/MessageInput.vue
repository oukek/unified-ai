<template>
  <div class="message-input">
    <textarea
      ref="textareaRef"
      v-model="inputText"
      placeholder="输入消息..."
      @keydown.enter.exact.prevent="newLine"
      @keydown.enter.shift.prevent="sendMessage"
      rows="1"
      class="message-textarea"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 自动调整文本域高度
function adjustTextareaHeight() {
  const textarea = textareaRef.value
  if (!textarea) return
  
  // 重置高度
  textarea.style.height = 'auto'
  
  // 设置新高度
  const newHeight = Math.min(textarea.scrollHeight, 200)  // 最大高度200px
  textarea.style.height = `${newHeight}px`
}

// 监听输入变化，调整高度
watch(inputText, () => {
  nextTick(adjustTextareaHeight)
})

// 组件挂载后初始化
onMounted(() => {
  adjustTextareaHeight()
})

// 换行
function newLine() {
  inputText.value += '\n'
}

// 发送消息
function sendMessage() {
  if (!inputText.value.trim()) return
  
  // 创建消息对象
  const messageText = inputText.value.trim()
  
  // 发出事件
  emit('send', messageText)
  
  // 清空输入框
  inputText.value = ''
  
  // 重置高度
  nextTick(adjustTextareaHeight)
}

// 定义事件
const emit = defineEmits<{
  (e: 'send', message: string): void
}>()
</script>

<style lang="less" scoped>
.message-input {
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  
  textarea {
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    border: none;
    border-radius: 8px;
    resize: none;
    outline: none;
    font-family: inherit;
    font-size: 15px;
    line-height: 1.5;
    transition: border-color 0.2s;
    background-color: #fff;
    color: #333;
    
    &:focus {
      border-color: var(--primary-color);
    }
    
    &::placeholder {
      color: #aaa;
    }
  }
}
</style> 