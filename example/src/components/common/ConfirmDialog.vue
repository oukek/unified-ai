<template>
  <div class="confirm-dialog-backdrop" v-if="isOpen" @click="onCancel">
    <div class="confirm-dialog-content" @click.stop>
      <div class="confirm-dialog-header">
        <h3>{{ title }}</h3>
        <button class="close-btn" @click="onCancel">×</button>
      </div>
      <div class="confirm-dialog-body">
        <p>{{ message }}</p>
      </div>
      <div class="confirm-dialog-footer">
        <button class="cancel-btn" @click="onCancel">{{ cancelText }}</button>
        <button class="confirm-btn" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isOpen: boolean,
  title: string,
  message: string,
  confirmText?: string,
  cancelText?: string
}>()

const emit = defineEmits<{
  (e: 'confirm'): void,
  (e: 'cancel'): void
}>()

function onConfirm() {
  emit('confirm')
}

function onCancel() {
  emit('cancel')
}
</script>

<style lang="less" scoped>
.confirm-dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-dialog-content {
  width: 400px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.confirm-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e5e5;
  
  h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
  
  .close-btn {
    background: none;
    border: none;
    font-size: 22px;
    cursor: pointer;
    color: #888;
    
    &:hover {
      color: #333;
    }
  }
}

.confirm-dialog-body {
  padding: 20px;
  
  p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
  }
}

.confirm-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e5e5;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  
  button {
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .cancel-btn {
    background-color: #f5f5f5;
    border: 1px solid #ddd;
    color: #333;
    
    &:hover {
      background-color: #eaeaea;
    }
  }
  
  .confirm-btn {
    background-color: var(--primary-color);
    border: 1px solid var(--primary-color);
    color: white;
    
    &:hover {
      background-color: darken(#4caf50, 5%);
    }
  }
}
</style> 