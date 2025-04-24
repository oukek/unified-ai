<template>
  <teleport to="body">
    <div 
      v-if="isVisible" 
      class="toast-container" 
      :class="[`toast-${type}`]"
    >
      <div class="toast-content">
        <SvgIcon 
          :name="iconName" 
          :size="20" 
          :color="iconColor" 
        />
        <span class="toast-message">{{ message }}</span>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import SvgIcon from './SvgIcon.vue'

type ToastType = 'info' | 'success' | 'error' | 'warning'

const props = defineProps<{
  message: string
  type?: ToastType
  duration?: number
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
}>()

const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 根据类型计算图标名称
const iconName = computed(() => {
  switch (props.type) {
    case 'success': return 'check-circle'
    case 'error': return 'alert-circle'
    case 'warning': return 'alert-triangle'
    case 'info': 
    default: return 'info'
  }
})

// 根据类型计算图标颜色
const iconColor = computed(() => {
  switch (props.type) {
    case 'success': return '#4caf50'
    case 'error': return '#f44336'  
    case 'warning': return '#ff9800'
    case 'info':
    default: return '#2196f3'
  }
})

// 监听显示状态变化
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 设置定时器，自动隐藏
    const timer = setTimeout(() => {
      isVisible.value = false
    }, props.duration || 3000)
    
    return () => clearTimeout(timer)
  }
})
</script>

<style lang="less" scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  min-width: 250px;
  max-width: 350px;
  padding: 12px 16px;
  border-radius: 4px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
  animation: toast-in 0.3s ease forwards;
  
  &.toast-info {
    background-color: #e3f2fd;
    border-left: 4px solid #2196f3;
  }
  
  &.toast-success {
    background-color: #e8f5e9;
    border-left: 4px solid #4caf50;
  }
  
  &.toast-error {
    background-color: #ffebee;
    border-left: 4px solid #f44336;
  }
  
  &.toast-warning {
    background-color: #fff3e0;
    border-left: 4px solid #ff9800;
  }
  
  .toast-content {
    display: flex;
    align-items: center;
    
    .toast-message {
      margin-left: 12px;
      font-size: 14px;
      color: #333;
    }
  }
}

@keyframes toast-in {
  0% {
    opacity: 0;
    transform: translateY(-20px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style> 