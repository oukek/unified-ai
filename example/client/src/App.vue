<script setup lang="ts">
import ErrorMessage from './components/ErrorMessage.vue'
</script>

<template>
  <main>
    <router-view />
    <ErrorMessage />
  </main>
</template>

<style>
:root {
  --main-text-color: #333;
  --error-color: #dc2626;
  --primary-color: #10a37f;
  --border-color: #d9d9e3;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu,
    Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  font-size: 15px;
  color: var(--main-text-color);
  background-color: #f7f7f8;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

main {
  position: relative;
  min-height: 100vh;
}

button {
  cursor: pointer;
  font-family: inherit;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
