<template>
  <div class="content-text-block">
    <div v-if="isLoading && enableTyping">
      <div v-html="renderMarkdown(typingText)"></div>
      <span v-if="isCurrentlyTyping" class="typing-cursor"></span>
    </div>
    <div v-else v-html="renderMarkdown(block.content || '')"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import type { ContentBlock } from '@/types/chat'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps<{
  block: ContentBlock
  isLoading: boolean
}>()

const emit = defineEmits(['scrollToBottom'])

// 是否启用打字机效果
const enableTyping = ref(true)

// 打字机效果相关状态
const typingText = ref('')
const isCurrentlyTyping = ref(false)
const typingSpeed = 10 // 打字速度（毫秒）
const currentCharIndex = ref(0)

// 开始打字效果
function startTyping() {
  if (!props.block.content || !props.isLoading || !enableTyping.value) return
  
  isCurrentlyTyping.value = true
  typeNextChar()
}

// 打字效果：逐字符显示内容
function typeNextChar() {
  if (!props.block.content || !props.isLoading) {
    finishTyping()
    return
  }
  
  if (currentCharIndex.value < props.block.content.length) {
    // 添加下一个字符
    typingText.value = props.block.content.substring(0, currentCharIndex.value + 1)
    currentCharIndex.value++
    
    // 触发滚动到底部
    emit('scrollToBottom')
    
    // 继续打字
    setTimeout(() => typeNextChar(), typingSpeed)
  } else {
    // 打字完成
    isCurrentlyTyping.value = false
  }
}

// 完成打字，显示全部内容
function finishTyping() {
  if (!props.block.content) return
  
  typingText.value = props.block.content
  isCurrentlyTyping.value = false
  currentCharIndex.value = props.block.content.length
}

// 监听内容变化
watch(() => props.block.content, (newContent) => {
  if (props.isLoading && newContent) {
    // 如果已经开始打字并且内容更新了
    if (isCurrentlyTyping.value && typingText.value.length > 0) {
      // 如果新内容比当前显示的内容长，继续从当前位置打字
      if (newContent.length > typingText.value.length) {
        typeNextChar()
      }
    } else {
      // 如果还没开始打字，就开始打字
      startTyping()
    }
  } else if (!props.isLoading && newContent) {
    // 如果加载完成，直接显示全部内容
    finishTyping()
  }
}, { immediate: true, deep: true })

// 监听加载状态变化
watch(() => props.isLoading, (newIsLoading) => {
  if (!newIsLoading && props.block.content) {
    // 加载结束，显示完整内容
    finishTyping()
  } else if (newIsLoading && props.block.content && typingText.value.length === 0) {
    // 如果开始加载并且有内容但还未开始打字，启动打字效果
    startTyping()
  }
})

// 组件挂载时
onMounted(() => {
  if (props.isLoading && props.block.content) {
    // 如果初始状态就在加载中，开始打字效果
    startTyping()
  } else if (!props.isLoading && props.block.content) {
    // 否则直接显示全部内容
    finishTyping()
  }
})
</script>

<style lang="less" scoped>
.content-text-block {
  margin-bottom: 12px;
  
  .typing-cursor {
    display: inline-block;
    width: 2px;
    height: 1em;
    background-color: #5178e7;
    vertical-align: text-bottom;
    margin-left: 1px;
    animation: blink 1s step-end infinite;
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