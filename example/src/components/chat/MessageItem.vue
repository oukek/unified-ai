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
      <div v-if="message.role === 'user'" class="content-body" v-html="renderedContent"></div>
      <div v-else class="content-body">
        <!-- 当消息为空时显示加载动画 -->
        <div v-if="!message.content && (!message.blocks || message.blocks.length === 0)" class="loading-animation">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
        
        <!-- 如果有message.blocks，则使用blocks渲染 -->
        <template v-else-if="message.blocks && message.blocks.length > 0">
          <div v-for="(block, index) in message.blocks" :key="index">
            <!-- 文本块 -->
            <div v-if="block.type === 'text' && block.content" class="content-text-block">
              <div v-if="typing && enableTyping">
                <div v-html="renderMarkdown(typingBlocks[index] || '')"></div>
                <span v-if="currentTypingBlockIndex === index" class="typing-cursor"></span>
              </div>
              <div v-else v-html="renderMarkdown(block.content)"></div>
            </div>
            
            <!-- 工具调用块 -->
            <div v-else-if="block.type === 'tool' && block.data" class="function-call-wrapper">
              <div 
                :class="['function-call-item', {'is-executing': isToolExecuting(block.data)}]" 
                @click="toggleToolExpand(block.data)"
              >
                <div class="function-call-header">
                  <SvgIcon name="tool" :size="16" color="#5178e7" />
                  <span class="function-name">{{ block.data.name }}</span>
                  
                  <div class="function-status">
                    <!-- 执行中状态 -->
                    <div v-if="isToolExecuting(block.data)" class="executing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <!-- 箭头图标 -->
                    <SvgIcon 
                      :name="expandedTools[block.data.id || ''] ? 'chevron-up' : 'chevron-down'" 
                      :size="14" 
                      color="#888" 
                    />
                  </div>
                </div>
                
                <!-- 展开的工具调用详情 -->
                <div v-if="block.data.id && expandedTools[block.data.id]" class="function-call-body">
                  <div class="function-arguments">
                    <div class="section-header">参数:</div>
                    <pre>{{ JSON.stringify(block.data.arguments, null, 2) }}</pre>
                  </div>
                  <div v-if="block.data.result !== undefined" class="function-result">
                    <div class="section-header">结果:</div>
                    <pre>{{ JSON.stringify(block.data.result, null, 2) }}</pre>
                  </div>
                  <div v-else class="executing-message">
                    <div class="loading-spinner"></div>
                    <span>正在执行...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 如果没有blocks，则使用原始方式渲染 -->
        <template v-else>
          <div v-if="typing && enableTyping" class="typing-content" v-html="renderMarkdown(displayedContent)"></div>
          <div v-else v-html="renderedContent"></div>
          
          <!-- 原始的工具调用显示部分 -->
          <div v-if="message.functionCalls && message.functionCalls.length > 0" class="function-calls-legacy">
            <div 
              v-for="(call, index) in message.functionCalls" 
              :key="index" 
              class="function-call-item"
              :class="{'is-executing': !call.result}"
              @click="toggleLegacyToolExpand(index)"
            >
              <div class="function-call-header">
                <SvgIcon name="tool" :size="16" color="#5178e7" />
                <span class="function-name">{{ call.name }}</span>
                
                <div class="function-status">
                  <!-- 执行中状态 -->
                  <div v-if="!call.result" class="executing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <!-- 箭头图标 -->
                  <SvgIcon 
                    :name="expandedLegacyTools[index] ? 'chevron-up' : 'chevron-down'" 
                    :size="14" 
                    color="#888" 
                    class="chevron-icon"
                  />
                </div>
              </div>
              <div v-if="expandedLegacyTools[index]" class="function-call-body">
                <div class="function-arguments">
                  <div class="section-header">参数:</div>
                  <pre>{{ JSON.stringify(call.arguments, null, 2) }}</pre>
                </div>
                <div v-if="call.result !== undefined" class="function-result">
                  <div class="section-header">结果:</div>
                  <pre>{{ JSON.stringify(call.result, null, 2) }}</pre>
                </div>
                <div v-else class="executing-message">
                  <div class="loading-spinner"></div>
                  <span>正在执行...</span>
                </div>
              </div>
            </div>
          </div>
        </template>
        
        <div v-if="isTyping && enableTyping" class="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMessage } from '@/stores/chat'
import SvgIcon from '@/components/common/SvgIcon.vue'
import { ref, computed, onMounted, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css' // 导入默认的 GitHub 风格样式
import dayjs from 'dayjs' // 导入 dayjs
import 'dayjs/locale/zh-cn' // 导入中文语言包

// 设置 dayjs 语言为中文
dayjs.locale('zh-cn')

// 扩展 ChatMessage 类型以包含函数调用
interface FunctionCall {
  id?: string // 添加ID用于展开/折叠状态跟踪
  name: string
  arguments: Record<string, any>
  result?: any
  executing?: boolean // 是否正在执行中
}

// 内容块类型
interface ContentBlock {
  type: 'text' | 'tool' // 文本块或工具调用块
  content?: string // 文本内容
  data?: FunctionCall // 工具调用数据
}

// 扩展 ChatMessage 接口来支持内容块
interface EnhancedChatMessage extends ChatMessage {
  functionCalls?: FunctionCall[]
  blocks?: ContentBlock[] // 消息内容块
  isLoading?: boolean // 是否正在加载中
}

const props = defineProps<{
  message: EnhancedChatMessage
}>()

// 自定义事件
const emit = defineEmits(['scrollToBottom'])

// 发送滚动到底部事件
function triggerScrollToBottom() {
  emit('scrollToBottom')
}

// 工具调用展开状态
const expandedTools = ref<Record<string, boolean>>({})
const expandedLegacyTools = ref<Record<number, boolean>>({})

// 是否启用打字机效果
const enableTyping = ref(true)

// 创建 markdown 实例
const md = (() => {
  const instance = new MarkdownIt({
    linkify: true,
    breaks: true,
    html: false,
    highlight: function (str: string, lang: string): string {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><code>' +
                hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
                '</code></pre>';
        } catch (__) {}
      }
      
      return '<pre class="hljs"><code>' + instance.utils.escapeHtml(str) + '</code></pre>';
    }
  });
  return instance;
})();

// 打字机效果相关状态
const typing = ref(props.message.role === 'assistant' && props.message.isLoading === true)
const isTyping = ref(props.message.role === 'assistant' && props.message.isLoading === true)
const displayedContent = ref('')
const typingSpeed = 10 // 打字速度（毫秒）
const typingIndex = ref(0)

// 为块级打字机效果添加状态
const typingBlocks = ref<string[]>([])
const currentTypingBlockIndex = ref(0)
const currentBlockTypingIndex = ref(0)

// 跟踪上一次的内容，用于判断stream更新
const previousContent = ref(props.message.content || '')
const previousBlocksLength = ref(props.message.blocks?.length || 0)

// 渲染 Markdown 内容
const renderedContent = computed(() => {
  if (props.message.role === 'user') {
    return md.render(props.message.content || '')
  } else {
    // 对于AI助手，根据加载状态决定显示方式
    return typing.value ? renderMarkdown(displayedContent.value) : md.render(props.message.content || '')
  }
})

// 单独渲染文本块的Markdown
function renderMarkdown(text: string): string {
  return md.render(text || '')
}

// 判断工具是否执行中
function isToolExecuting(tool: FunctionCall): boolean {
  return tool.executing === true || tool.result === undefined
}

// 切换工具调用的展开/折叠状态
function toggleToolExpand(tool: FunctionCall): void {
  if (!tool.id) return
  expandedTools.value[tool.id] = !expandedTools.value[tool.id]
}

// 切换旧式工具调用的展开/折叠状态
function toggleLegacyToolExpand(index: number): void {
  expandedLegacyTools.value[index] = !expandedLegacyTools.value[index]
}

// 打字机效果函数
function typeWriter() {
  // 检查消息内容是否发生变化
  const hasNewContent = props.message.content !== previousContent.value
  previousContent.value = props.message.content || ''
  
  // 如果有块，使用块级打字机效果
  if (props.message.blocks && props.message.blocks.length > 0) {
    previousBlocksLength.value = props.message.blocks.length
    
    typeBlockWriter()
    return
  }
  
  // 默认的打字机效果
  if (typingIndex.value < (props.message.content || '').length) {
    // 只处理新内容，避免从头开始
    if (hasNewContent) {
      // 直接更新到当前位置，并从当前位置继续打字效果
      const currentPosition = Math.max(displayedContent.value.length, typingIndex.value)
      displayedContent.value = props.message.content.substring(0, currentPosition + 1)
      typingIndex.value = currentPosition + 1
    } else {
      displayedContent.value += props.message.content.charAt(typingIndex.value)
      typingIndex.value++
    }
    
    // 触发滚动到底部
    triggerScrollToBottom()
    
    setTimeout(typeWriter, typingSpeed)
  } else {
    // 检查是否仍在加载中，如果是，不要结束打字机效果
    if (props.message.isLoading) {
      // 等待更多内容
      setTimeout(() => {
        // 再次检查是否有新内容
        if ((props.message.content || '').length > typingIndex.value) {
          typeWriter() // 如果有新内容，继续打字
        } else {
          setTimeout(typeWriter, 100) // 否则等待100ms后再检查
        }
      }, 100)
    } else {
      // 加载完成，结束打字机效果
      typing.value = false
      isTyping.value = false
      
      // 结束时也触发一次滚动
      triggerScrollToBottom()
    }
  }
}

// 块级打字机效果
function typeBlockWriter() {
  const blocks = props.message.blocks || []
  
  // 确保有足够的数组元素
  if (typingBlocks.value.length < blocks.length) {
    // 保留现有块内容，只扩展数组
    const currentLength = typingBlocks.value.length
    typingBlocks.value = [
      ...typingBlocks.value, 
      ...Array(blocks.length - currentLength).fill('')
    ]
  }
  
  // 查找当前需要处理的文本块
  while (currentTypingBlockIndex.value < blocks.length) {
    const block = blocks[currentTypingBlockIndex.value]
    
    // 只对文本块应用打字机效果
    if (block.type === 'text' && block.content) {
      const currentTypingBlock = typingBlocks.value[currentTypingBlockIndex.value] || ''
      
      // 如果有新内容，直接更新到当前位置
      if (currentTypingBlock.length > 0 && currentTypingBlock.length < block.content.length) {
        // 获取新增的内容，立即显示
        const currentPosition = Math.max(currentTypingBlock.length, currentBlockTypingIndex.value)
        typingBlocks.value[currentTypingBlockIndex.value] = block.content.substring(0, currentPosition + 1)
        currentBlockTypingIndex.value = currentPosition + 1
        break
      }
      
      // 检查当前块是否已经完成
      if (currentTypingBlock.length >= block.content.length) {
        // 当前块已完成，移到下一个
        currentTypingBlockIndex.value++
        currentBlockTypingIndex.value = 0
        continue
      }
      break
    } else {
      // 跳过非文本块
      currentTypingBlockIndex.value++
      currentBlockTypingIndex.value = 0
    }
  }
  
  // 如果已经处理完所有块，检查是否有新块
  if (currentTypingBlockIndex.value >= blocks.length) {
    // 检查是否仍在加载中，如果是，不要结束打字机效果
    if (props.message.isLoading) {
      // 等待更多内容
      setTimeout(() => {
        // 再次检查是否有新块
        if (props.message.blocks && props.message.blocks.length > blocks.length) {
          // 重置索引到新块
          currentTypingBlockIndex.value = blocks.length
          currentBlockTypingIndex.value = 0
          typeBlockWriter() // 如果有新块，继续打字
        } else {
          setTimeout(() => typeBlockWriter(), 100) // 否则等待100ms后再检查
        }
      }, 100)
    } else {
      // 加载完成，结束打字机效果
      typing.value = false
      isTyping.value = false
      
      // 结束时触发滚动
      triggerScrollToBottom()
    }
    return
  }
  
  const currentBlock = blocks[currentTypingBlockIndex.value]
  
  // 确保是文本块且有内容
  if (currentBlock.type === 'text' && currentBlock.content) {
    const text = currentBlock.content
    
    // 确保当前块的typingBlocks已初始化
    if (!typingBlocks.value[currentTypingBlockIndex.value]) {
      typingBlocks.value[currentTypingBlockIndex.value] = ''
    }
    
    if (currentBlockTypingIndex.value < text.length) {
      // 添加下一个字符
      typingBlocks.value[currentTypingBlockIndex.value] += text.charAt(currentBlockTypingIndex.value)
      currentBlockTypingIndex.value++
      
      // 触发滚动到底部
      triggerScrollToBottom()
      
      setTimeout(() => typeBlockWriter(), typingSpeed)
    } else {
      // 当前块完成，移动到下一个
      currentTypingBlockIndex.value++
      currentBlockTypingIndex.value = 0
      setTimeout(() => typeBlockWriter(), typingSpeed)
    }
  } else {
    // 不是文本块，移到下一个
    currentTypingBlockIndex.value++
    currentBlockTypingIndex.value = 0
    setTimeout(() => typeBlockWriter(), typingSpeed)
  }
}

// 监听消息内容的变化，处理单独的内容更新（特别是blocks）
watch([
  () => props.message.content,
  () => props.message.blocks,
  () => props.message.isLoading
], ([newContent, newBlocks, isLoading], [oldContent, oldBlocks, wasLoading]) => {
  if (props.message.role === 'assistant') {
    if (isLoading) {
      // 消息正在加载中，确保打字机状态激活
      typing.value = true;
      isTyping.value = true;
      
      // 内容有变化，立即更新显示
      if (newContent !== oldContent) {
        // 有新内容，继续从当前位置播放打字效果
        // 使用更短的延迟确保UI立即更新
        setTimeout(typeWriter, 0);
      }
      
      // 检查是否有新的段落块添加
      if (newBlocks && oldBlocks && Array.isArray(newBlocks) && Array.isArray(oldBlocks)) {
        // 检查内容更新，无论是新块还是现有块内容更新
        let hasBlockUpdates = newBlocks.length > oldBlocks.length;
        
        if (!hasBlockUpdates && newBlocks.length === oldBlocks.length) {
          // 检查是否有任何块的内容更新
          for (let i = 0; i < newBlocks.length; i++) {
            const newBlock = newBlocks[i];
            const oldBlock = oldBlocks[i];
            
            if (newBlock.type === 'text' && oldBlock.type === 'text' && 
                newBlock.content !== oldBlock.content) {
              hasBlockUpdates = true;
              break;
            }
          }
        }
        
        if (hasBlockUpdates) {
          // 有新块或内容更新，立即更新打字效果
          previousBlocksLength.value = newBlocks.length;
          
          // 立即更新UI，不使用延迟
          typeBlockWriter();
        }
      }
    } else if (wasLoading && !isLoading) {
      // 从加载状态切换到完成状态
      typing.value = false;
      isTyping.value = false;
      // 确保显示完整内容
      displayedContent.value = props.message.content || '';
      
      // 确保所有块内容最终完整显示
      if (props.message.blocks && props.message.blocks.length > 0) {
        props.message.blocks.forEach((block, index) => {
          if (block.type === 'text' && block.content) {
            if (index < typingBlocks.value.length) {
              typingBlocks.value[index] = block.content;
            } else if (typingBlocks.value.length <= index) {
              typingBlocks.value.push(block.content);
            }
          }
        });
      }
      
      // 确保触发一次滚动
      triggerScrollToBottom();
    }
  }
}, { deep: true, immediate: true }) // 添加immediate以确保首次渲染时也执行

// 组件挂载时启动打字机效果
onMounted(() => {
  if (props.message.role === 'assistant' && props.message.isLoading === true && enableTyping.value) {
    // 重置状态
    typing.value = true
    isTyping.value = true
    displayedContent.value = ''
    typingIndex.value = 0
    typingBlocks.value = []
    currentTypingBlockIndex.value = 0
    currentBlockTypingIndex.value = 0
    
    // 设置初始内容
    previousContent.value = props.message.content || ''
    previousBlocksLength.value = props.message.blocks?.length || 0
    
    // 启动打字机效果
    setTimeout(typeWriter, typingSpeed)
  } else {
    // 对于历史消息（非加载中），直接显示完整内容
    typing.value = false
    isTyping.value = false
  }
})

// 格式化时间
function formatTime(date: Date | string): string {
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
      
      .typing-control {
        margin-left: auto;
        font-size: 12px;
        color: #5178e7;
        cursor: pointer;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
    
    .content-body {
      font-size: 15px;
      line-height: 1.6;
      word-break: break-word;
      
      // 加载动画样式
      .loading-animation {
        padding: 10px 0;
        
        .loading-dots {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin-bottom: 8px;
          
          span {
            width: 8px;
            height: 8px;
            margin: 0 4px;
            background-color: #5178e7;
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
        
        .loading-text {
          color: #5178e7;
          font-size: 14px;
        }
      }
      
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
      
      .function-call-wrapper {
        margin: 12px 0;
      }
      
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
      
      // 工具调用相关样式
      .function-calls-legacy {
        margin-top: 12px;
        padding-top: 12px;
      }
      
      .function-call-item {
        background-color: #f6f8fa;
        border-radius: 6px;
        margin-bottom: 12px;
        overflow: hidden;
        border: 1px solid #dfe2e5;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &:hover {
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
        }
        
        &.is-executing {
          border-color: #5178e7;
          
          .function-call-header {
            background-color: #e1eaff;
          }
        }
        
        .function-call-header {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background-color: #e1eaff;
          border-bottom: 1px solid #dfe2e5;
          position: relative;
          
          .function-name {
            margin-left: 8px;
            font-weight: 600;
            font-size: 14px;
            flex-grow: 1;
          }
          
          .function-status {
            display: flex;
            align-items: center;
            
            .executing-indicator {
              display: inline-flex;
              align-items: center;
              margin-right: 8px;
              
              span {
                width: 4px;
                height: 4px;
                margin: 0 1px;
                background-color: #5178e7;
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
          
          .chevron-icon {
            margin-left: 8px;
          }
        }
        
        .function-call-body {
          padding: 12px;
          border-top: 1px solid #dfe2e5;
          
          .function-arguments, .function-result {
            .section-header {
              font-weight: 600;
              margin-bottom: 4px;
              font-size: 14px;
              color: #24292e;
            }
            
            pre {
              margin: 0;
              background-color: #f6f8fa;
              padding: 8px;
              border-radius: 4px;
              overflow: auto;
              font-size: 13px;
              white-space: break-spaces;
            }
          }
          
          .function-result {
            margin-top: 12px;
          }
          
          .executing-message {
            display: flex;
            align-items: center;
            margin-top: 12px;
            color: #5178e7;
            font-size: 14px;
            
            .loading-spinner {
              width: 16px;
              height: 16px;
              border: 2px solid #e1eaff;
              border-top: 2px solid #5178e7;
              border-radius: 50%;
              margin-right: 8px;
              animation: spin 1s linear infinite;
            }
          }
        }
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