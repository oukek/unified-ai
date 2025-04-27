import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes = [
  {
    path: '/',
    name: 'Chat',
    component: () => import('../views/Chat.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { guest: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局前置守卫
router.beforeEach((to, _, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isGuestOnly = to.matched.some(record => record.meta.guest)
  
  // 如果用户状态未初始化，则先初始化
  if (!userStore.isInitialized) {
    userStore.initialize()
  }
  
  // 需要认证的页面
  if (requiresAuth && !userStore.isLoggedIn) {
    next({ name: 'Login' })
  } 
  // 仅游客可访问的页面（如登录页），已登录用户访问则重定向到首页
  else if (isGuestOnly && userStore.isLoggedIn) {
    next({ name: 'Chat' })
  }
  // 其他情况正常访问
  else {
    next()
  }
})

export default router 