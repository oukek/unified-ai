<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

// Get the app store
const appStore = useAppStore()
</script>

<template>
  <div v-if="appStore.error" class="error-container">
    <div class="error-message">{{ appStore.error }}</div>
  </div>
</template>

<style scoped>
.error-container {
  padding: 15px;
  background-color: rgba(254, 226, 226, 0.8);
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 6px;
  max-width: 90%;
  z-index: 100;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  animation: fadeIn 0.3s ease-out;
}

.error-message {
  color: var(--error-color, #dc2626);
  font-size: 14px;
  font-weight: 500;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, 10px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
