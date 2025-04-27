<template>
  <div class="function-call-wrapper">
    <div 
      :class="['function-call-item', {'is-executing': isExecuting}]" 
      @click="toggleExpand"
    >
      <div class="function-call-header">
        <SvgIcon name="tool" :size="16" color="#5178e7" />
        <span class="function-name">{{ toolData.name }} {{ toolData.executionTime ? `(执行时长:${toolData.executionTime}ms)` : '' }}</span>
        
        <div class="function-status">
          <!-- 执行中状态 -->
          <div v-if="isExecuting" class="executing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <!-- 箭头图标 -->
          <SvgIcon 
            :name="isExpanded ? 'chevron-up' : 'chevron-down'" 
            :size="14" 
            color="#888" 
          />
        </div>
      </div>
      
      <!-- 展开的工具调用详情 -->
      <div v-if="isExpanded" class="function-call-body">
        <div class="function-arguments">
          <div class="section-header">参数:</div>
          <pre>{{ JSON.stringify(toolData.arguments, null, 2) }}</pre>
        </div>
        <div v-if="toolData.result !== undefined" class="function-result">
          <div class="section-header">结果:</div>
          <pre>{{ JSON.stringify(toolData.result, null, 2) }}</pre>
        </div>
        <div v-else class="executing-message">
          <div class="loading-spinner"></div>
          <span>正在执行...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/common/SvgIcon.vue'
import type { ContentBlock, FunctionCall } from '@/types/chat'
import { computed, ref } from 'vue'

const props = defineProps<{
  block: ContentBlock
}>()

// 获取工具数据
const toolData = computed<FunctionCall>(() => {
  return props.block.data as FunctionCall
})

// 计算工具是否正在执行
const isExecuting = computed(() => {
  return toolData.value.executing === true || toolData.value.result === undefined
})

// 本地管理展开状态，默认为关闭
const isExpanded = ref(false)

// 切换展开/折叠状态
function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}
</script>

<style lang="less" scoped>
.function-call-wrapper {
  margin: 12px 0;
}

// 工具调用相关样式
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
</style> 