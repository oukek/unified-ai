import { createPinia } from 'pinia'

// 导出stores
export * from './chat'
export * from './settings'
export * from './tools'

const pinia = createPinia()

export default pinia 