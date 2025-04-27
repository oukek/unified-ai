import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import pinia from './stores'
import GlobalToast from './components/common/GlobalToast.vue'
import { initSocketManager } from './utils/socketManager'

const app = createApp(App)

// 创建全局Toast组件
const ToastPlugin = createApp(GlobalToast)
// 挂载到独立的DOM元素
const toastDiv = document.createElement('div')
toastDiv.id = 'global-toast'
document.body.appendChild(toastDiv)
ToastPlugin.mount('#global-toast')

app.use(router)
app.use(pinia)

// 初始化Socket管理器
initSocketManager()

app.mount('#app')
