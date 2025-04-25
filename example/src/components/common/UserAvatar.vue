<template>
  <div class="user-avatar-container">
    <!-- 用户头像 -->
    <div class="avatar" @click="toggleDropdown">
      <div class="avatar-text">{{ userInitial }}</div>
    </div>
    
    <!-- 下拉菜单 -->
    <div class="dropdown-menu" v-if="isDropdownOpen" v-click-outside="closeDropdown">
      <div class="menu-header">
        <div class="username">{{ username }}</div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-items">
        <div class="menu-item" @click="handleSettingsClick">
          <span>设置</span>
        </div>
        <div class="menu-item logout" @click="handleLogout">
          <span>退出登录</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 声明HTMLElement扩展类型
declare global {
  interface HTMLElement {
    _clickOutside?: (event: MouseEvent) => void;
  }
}

// 属性
const props = defineProps({
  username: {
    type: String,
    default: ''
  }
})

// 初始化
const router = useRouter()
const userStore = useUserStore()
const isDropdownOpen = ref(false)

// 计算用户名首字母作为头像文本
const userInitial = computed(() => {
  if (props.username) {
    return props.username.charAt(0).toUpperCase()
  }
  return 'U'
})

// 切换下拉菜单
const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value
}

// 关闭下拉菜单
const closeDropdown = () => {
  isDropdownOpen.value = false
}

// 处理设置点击
const handleSettingsClick = () => {
  closeDropdown()
  // 这里可以跳转到设置页面或打开设置对话框
  // router.push('/settings')
}

// 处理退出登录
const handleLogout = () => {
  closeDropdown()
  userStore.logout()
  router.push('/login')
}

// 点击外部关闭下拉菜单的指令
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    const clickOutsideHandler = (event: MouseEvent) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value(event)
      }
    }
    
    el._clickOutside = clickOutsideHandler
    document.addEventListener('click', clickOutsideHandler)
  },
  unmounted(el: HTMLElement) {
    if (el._clickOutside) {
      document.removeEventListener('click', el._clickOutside)
      delete el._clickOutside
    }
  }
}
</script>

<style lang="less" scoped>
.user-avatar-container {
  position: relative;
  display: inline-block;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  
  .avatar-text {
    font-size: 18px;
    font-weight: 500;
  }
}

.dropdown-menu {
  position: absolute;
  top: 50px;
  right: 0;
  width: 200px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 10;
  
  .menu-header {
    padding: 12px 16px;
    
    .username {
      font-size: 14px;
      font-weight: 500;
      color: #333;
    }
  }
  
  .menu-divider {
    height: 1px;
    background-color: #e8e8e8;
    margin: 0;
  }
  
  .menu-items {
    .menu-item {
      padding: 12px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      
      &:hover {
        background-color: #f5f7fa;
      }
      
      &.logout {
        color: #f56c6c;
      }
    }
  }
}
</style> 