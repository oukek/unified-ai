import { createPinia } from 'pinia'

// 导出stores
export * from './chat'
export * from './settings'
export * from './tools'
export * from './user'

const pinia = createPinia()

export default pinia 