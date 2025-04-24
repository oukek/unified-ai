<script setup lang="ts">
// 无需导入其他组件，使用路由管理页面
</script>

<template>
  <div class="app-container">
    <main>
      <router-view />
    </main>
  </div>
</template>

<style lang="less">
:root {
  --primary-color: #4caf50;
  --text-color: #333;
  --background-color: #fff;
  --light-bg: #f8f9fa;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
}

body {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: var(--text-color);
  background-color: var(--background-color);
}

.app-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  
  main {
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
}

#app {
  height: 100%;
}
</style>
