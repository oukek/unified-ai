<template>
  <div class="login-page">
    <div class="login-container">
      <div class="header">
        <h1 class="title">{{ isRegister ? '注册账户' : '用户登录' }}</h1>
        <p class="subtitle">{{ isRegister ? '创建您的账户以使用UnifiedAI' : '登录您的账户以继续' }}</p>
      </div>
      
      <div class="form">
        <div class="form-item">
          <label for="username">用户名</label>
          <input 
            id="username" 
            v-model="username" 
            type="text" 
            placeholder="请输入用户名"
            @keyup.enter="!isRegister && password ? handleLogin() : null"
          />
        </div>
        
        <div class="form-item">
          <label for="password">密码</label>
          <input 
            id="password" 
            v-model="password" 
            type="password" 
            placeholder="请输入密码"
            @keyup.enter="!isRegister && username ? handleLogin() : null"
          />
        </div>
        
        <div v-if="isRegister" class="form-item">
          <label for="confirmPassword">确认密码</label>
          <input 
            id="confirmPassword" 
            v-model="confirmPassword" 
            type="password" 
            placeholder="请再次输入密码"
            @keyup.enter="isRegister && username && password && confirmPassword ? handleRegister() : null"
          />
        </div>
        
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        
        <div class="actions">
          <button 
            class="submit-btn"
            :disabled="loading || buttonDisabled"
            @click="isRegister ? handleRegister() : handleLogin()"
          >
            {{ loading ? '处理中...' : (isRegister ? '注册' : '登录') }}
          </button>
        </div>
        
        <div class="switch-mode">
          {{ isRegister ? '已有账户？' : '还没有账户？' }}
          <a href="javascript:;" @click="toggleMode">
            {{ isRegister ? '登录' : '注册' }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showSuccess } from '@/utils/toast'

const router = useRouter()
const userStore = useUserStore()

// 表单状态
const isRegister = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMessage = ref('')

// 切换登录/注册模式
const toggleMode = () => {
  isRegister.value = !isRegister.value
  errorMessage.value = ''
}

// 按钮是否禁用
const buttonDisabled = computed(() => {
  if (isRegister.value) {
    return !username.value || !password.value || !confirmPassword.value
  }
  return !username.value || !password.value
})

// 处理登录
const handleLogin = async () => {
  if (loading.value || !username.value || !password.value) return
  
  errorMessage.value = ''
  loading.value = true
  
  try {
    const result = await userStore.login(username.value, password.value)
    
    if (result.success) {
      // 登录成功，跳转到主页
      router.push('/')
    } else {
      // 登录失败，显示错误信息
      errorMessage.value = result.message || '登录失败，请稍后重试'
    }
  } catch (error) {
    console.error('登录出错', error)
    errorMessage.value = '登录过程中发生错误，请稍后重试'
  } finally {
    loading.value = false
  }
}

// 处理注册
const handleRegister = async () => {
  if (loading.value || !username.value || !password.value || !confirmPassword.value) return
  
  errorMessage.value = ''
  
  // 验证两次密码是否一致
  if (password.value !== confirmPassword.value) {
    errorMessage.value = '两次输入的密码不一致'
    return
  }
  
  loading.value = true
  
  try {
    const result = await userStore.register(username.value, password.value)
    
    if (result.success) {
      // 注册成功，切换到登录模式
      isRegister.value = false
      errorMessage.value = ''
      
      // 可选：保留用户名，清除密码
      password.value = ''
      confirmPassword.value = ''
      
      // 显示成功提示
      showSuccess('注册成功，请登录')
    } else {
      // 注册失败，显示错误信息
      errorMessage.value = result.message || '注册失败，请稍后重试'
    }
  } catch (error) {
    console.error('注册出错', error)
    errorMessage.value = '注册过程中发生错误，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style lang="less" scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f5f7fa;
}

.login-container {
  width: 420px;
  padding: 40px;
  background-color: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  
  .header {
    text-align: center;
    margin-bottom: 32px;
    
    .title {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #333;
    }
    
    .subtitle {
      font-size: 14px;
      color: #666;
    }
  }
  
  .form {
    .form-item {
      margin-bottom: 20px;
      
      label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
        color: #333;
      }
      
      input {
        width: 100%;
        height: 48px;
        padding: 0 16px;
        border: 1px solid #dcdfe6;
        border-radius: 4px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
        
        &:focus {
          border-color: #409eff;
        }
      }
    }
    
    .error-message {
      padding: 8px 12px;
      background-color: #fff2f0;
      border: 1px solid #ffccc7;
      margin-bottom: 20px;
      border-radius: 4px;
      color: #f56c6c;
      font-size: 14px;
    }
    
    .actions {
      margin-top: 12px;
      
      .submit-btn {
        width: 100%;
        height: 48px;
        background-color: #409eff;
        border: none;
        border-radius: 4px;
        color: #fff;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        
        &:hover {
          background-color: #66b1ff;
        }
        
        &:disabled {
          background-color: #a0cfff;
          cursor: not-allowed;
        }
      }
    }
    
    .switch-mode {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: #666;
      
      a {
        color: #409eff;
        margin-left: 4px;
        text-decoration: none;
        
        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}
</style> 