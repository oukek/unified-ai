import axios from 'axios'
import dayjs from 'dayjs'

export interface ToolParameter {
  type: string
  description: string
}

export interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  executor: (params: Record<string, any>) => Promise<any>
  configRequired?: {
    name: string
    description: string
  }[] // 需要配置的项
}

export const searchByGoogle: Tool = {
  name: 'searchByGoogle',
  description: '通过Google搜索网页内容，提取网页信息',
  parameters: {
    keyword: {
      type: 'string',
      description: '要搜索的关键词',
    },
    required: ['keyword'],
  },
  configRequired: [{
    name: 'GOOGLE_API_KEY',
    description: 'Google API 密钥',
  }, {
    name: 'GOOGLE_SEARCH_ENGINE_ID',
    description: 'Google 搜索引擎 ID',
  }],
  executor: async (params: Record<string, any>) => {
    try {
      const keyword = params.keyword as string
      console.log(`正在搜索: ${keyword}`)

      // 从配置中获取 API 密钥和搜索引擎 ID
      const API_KEY = params._config?.GOOGLE_API_KEY
      const SEARCH_ENGINE_ID = params._config?.GOOGLE_SEARCH_ENGINE_ID

      if (!API_KEY || !SEARCH_ENGINE_ID) {
        throw new Error('缺少必要的配置：GOOGLE_API_KEY 或 GOOGLE_SEARCH_ENGINE_ID')
      }

      // 构建 Google Custom Search API 请求 URL
      const url = 'https://www.googleapis.com/customsearch/v1'

      // 发送请求到 Google Custom Search API
      const response = await axios.get(url, {
        params: {
          key: API_KEY,
          cx: SEARCH_ENGINE_ID,
          q: keyword,
        },
      })

      // 检查请求是否成功
      if (response.status !== 200) {
        throw new Error(`API 请求失败，状态码：${response.status}`)
      }

      // 从响应中提取搜索结果
      const data = response.data

      // 提取所需的字段
      const searchResults = data.items
        ? data.items.map((item: any) => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
          }))
        : []

      return {
        searchResults: {
          tip: '搜索结果有附带 url，如果快照不够用，可考虑获取网页具体内容',
          data: searchResults,
        },
        url: `${url}?q=${encodeURIComponent(keyword)}`,
      }
    }
    catch (error: any) {
      console.error(`Google搜索出错: ${error.message}`)
      return {
        error: error.message,
        keyword: params.keyword,
      }
    }
  },
}

export const searchWebByUrl: Tool = {
  name: 'searchWebByUrl',
  description: '搜索网页内容，提取网页信息',
  parameters: {
    url: {
      type: 'string',
      description: '要搜索的完整网页URL，必须以http://或https://开头',
    },
    required: ['url'],
  },
  executor: async (params: Record<string, any>) => {
    try {
      const url = params.url as string
      console.log(`正在爬取网页: ${url}`)
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        timeout: 10000, // 10秒超时
      })

      // 返回网页内容
      return {
        content: response.data,
        status: response.status,
        url,
      }
    }
    catch (error: any) {
      console.error(`爬取网页时出错: ${error.message}`)
      return {
        error: error.message,
        url: params.url,
      }
    }
  },
}

export const getTime: Tool = {
  name: 'getTime',
  description: '获取指定时间，可以增加或减少天数，如果增加或减少天数为0，则返回当前时间，返回时间格式为YYYY-MM-DD HH:mm:ss',
  parameters: {
    addDays: {
      type: 'number',
      description: '要增加的天数',
    },
    subDays: {
      type: 'number',
      description: '要减少的天数',
    },
    required: ['addDays', 'subDays'],
  },
  executor: async (params: Record<string, any>) => {
    const addDays = params.addDays as number
    const subDays = params.subDays as number
    let time = dayjs()
    if (addDays !== 0) {
      time = time.add(addDays, 'day')
    }
    if (subDays !== 0) {
      time = time.subtract(subDays, 'day')
    }
    return {
      time: time.format('YYYY-MM-DD HH:mm:ss'),
    }
  },
}

// 所有可用工具列表
export const availableTools: Tool[] = [
  searchByGoogle,
  searchWebByUrl,
  getTime
] 