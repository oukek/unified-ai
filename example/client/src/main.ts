import { createPinia } from 'pinia'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

import { socketService } from './utils'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Initialize socket connection
socketService.connect()

app.mount('#app')
