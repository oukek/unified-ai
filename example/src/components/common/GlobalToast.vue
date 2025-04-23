<template>
  <teleport to="body">
    <div 
      v-if="toastState.show" 
      class="toast-container" 
      :class="[`toast-${toastState.type}`]"
    >
      <div class="toast-content">
        <SvgIcon 
          :name="iconName" 
          :size="20" 
          :color="iconColor" 
        />
        <span class="toast-message">{{ toastState.message }}</span>
      </div>
    </div>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from './SvgIcon.vue'
import { globalToast } from '@/utils/toast'

const toastState = globalToast

// 根据类型计算图标名称
const iconName = computed(() => {
  switch (toastState.value.type) {
    case 'success': return 'check-circle'
    case 'error': return 'alert-circle'
    case 'warning': return 'alert-triangle'
    case 'info': 
    default: return 'info'
  }
})

// 根据类型计算图标颜色
const iconColor = computed(() => {
  switch (toastState.value.type) {
    case 'success': return '#4caf50'
    case 'error': return '#f44336'  
    case 'warning': return '#ff9800'
    case 'info':
    default: return '#2196f3'
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