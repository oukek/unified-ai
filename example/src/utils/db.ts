import CryptoJS from 'crypto-js'

// 加密密钥，实际应用中应该使用更安全的方式管理
const ENCRYPTION_KEY = 'unifiedAI-secret-key'

// 数据库配置
const DB_NAME = 'unifiedAI'
const DB_VERSION = 3
const STORES = {
  SETTINGS: 'settings',
  CONVERSATIONS: 'conversations',
  TOOLS: 'tools'
}

// 加密函数
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

// 解密函数
export function decrypt(ciphertext: string): string {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

// 初始化数据库
export function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // 检查是否支持 IndexedDB
    if (!window.indexedDB) {
      console.error('您的浏览器不支持 IndexedDB')
      reject('浏览器不支持 IndexedDB')
      return
    }

    console.log(`打开数据库 ${DB_NAME}, 版本 ${DB_VERSION}`)
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    
    request.onerror = (event) => {
      console.error('打开数据库失败:', event)
      reject('数据库打开失败')
    }
    
    request.onsuccess = () => {
      console.log('数据库打开成功')
      resolve(request.result)
    }
    
    request.onupgradeneeded = () => {
      console.log('数据库升级中...')
      const db = request.result
      
      // 创建 settings 存储
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        console.log('创建 settings 存储')
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
      }
      
      // 创建 conversations 存储
      if (!db.objectStoreNames.contains(STORES.CONVERSATIONS)) {
        console.log('创建 conversations 存储')
        db.createObjectStore(STORES.CONVERSATIONS, { keyPath: 'id' })
      }
      
      // 创建 tools 存储
      if (!db.objectStoreNames.contains(STORES.TOOLS)) {
        console.log('创建 tools 存储')
        db.createObjectStore(STORES.TOOLS, { keyPath: 'key' })
      }
      
      console.log('数据库升级完成')
    }
  })
}

// 通用存储操作方法

// 保存数据
export async function saveData<T>(storeName: string, data: T): Promise<void> {
  try {
    // 先进行序列化测试，确保可以被正确序列化
    try {
      // 测试数据是否可序列化
      JSON.parse(JSON.stringify(data))
    } catch (error) {
      const serializeError = error as Error
      console.error(`数据无法序列化到 ${storeName}:`, serializeError)
      console.error('问题数据:', data)
      throw new Error(`数据无法序列化: ${serializeError.message}`)
    }
    
    const db = await initDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      let request
      try {
        request = store.put(data)
      } catch (error) {
        const putError = error as Error
        db.close()
        console.error(`保存到 ${storeName} 失败:`, putError)
        console.error('问题数据:', data)
        reject(`保存到 ${storeName} 失败: ${putError.message}`)
        return
      }
      
      request.onsuccess = () => {
        resolve()
      }
      
      request.onerror = (event) => {
        console.error(`保存到 ${storeName} 失败:`, event)
        console.error('问题数据类型:', typeof data)
        if (data && typeof data === 'object') {
          console.error('问题数据键:', Object.keys(data))
        }
        reject(`保存到 ${storeName} 失败: ${request.error?.message || '未知错误'}`)
      }
      
      transaction.oncomplete = () => db.close()
      transaction.onerror = (event) => {
        db.close()
        console.error(`事务错误:`, event)
        reject(`事务错误: ${transaction.error?.message || '未知错误'}`)
      }
    })
  } catch (error) {
    console.error(`保存到 ${storeName} 时出错:`, error)
    throw error
  }
}

// 获取单个数据
export async function getData<T>(storeName: string, key: string | number): Promise<T | null> {
  try {
    const db = await initDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(key)
      
      request.onsuccess = () => {
        db.close()
        resolve(request.result || null)
      }
      
      request.onerror = (event) => {
        console.error(`从 ${storeName} 获取数据失败:`, event)
        db.close()
        reject(`从 ${storeName} 获取数据失败`)
      }
    })
  } catch (error) {
    console.error(`从 ${storeName} 获取数据时出错:`, error)
    return null
  }
}

// 获取所有数据
export async function getAllData<T>(storeName: string): Promise<T[]> {
  try {
    const db = await initDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()
      
      request.onsuccess = () => {
        db.close()
        resolve(request.result || [])
      }
      
      request.onerror = (event) => {
        console.error(`从 ${storeName} 获取所有数据失败:`, event)
        db.close()
        reject(`从 ${storeName} 获取所有数据失败`)
      }
    })
  } catch (error) {
    console.error(`从 ${storeName} 获取所有数据时出错:`, error)
    return []
  }
}

// 删除数据
export async function deleteData(storeName: string, key: string | number): Promise<void> {
  try {
    const db = await initDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(key)
      
      request.onsuccess = () => {
        db.close()
        resolve()
      }
      
      request.onerror = (event) => {
        console.error(`从 ${storeName} 删除数据失败:`, event)
        db.close()
        reject(`从 ${storeName} 删除数据失败`)
      }
    })
  } catch (error) {
    console.error(`从 ${storeName} 删除数据时出错:`, error)
    throw error
  }
}

// 清空存储
export async function clearStore(storeName: string): Promise<void> {
  try {
    const db = await initDatabase()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.clear()
      
      request.onsuccess = () => {
        db.close()
        resolve()
      }
      
      request.onerror = (event) => {
        console.error(`清空 ${storeName} 失败:`, event)
        db.close()
        reject(`清空 ${storeName} 失败`)
      }
    })
  } catch (error) {
    console.error(`清空 ${storeName} 时出错:`, error)
    throw error
  }
}

// 导出常量
export const DB = {
  STORES
} 