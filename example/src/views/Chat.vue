<template>
  <div class="chat-page">
    <Sidebar />
    <ChatConversation />
  </div>
</template>

<script setup lang="ts">
import Sidebar from '@/components/chat/Sidebar.vue'
import ChatConversation from '@/components/chat/ChatConversation.vue'
</script>

<style lang="less" scoped>
.chat-page {
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: #fff;
  overflow: hidden;
}
</style> 