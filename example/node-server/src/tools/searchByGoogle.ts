import process from 'node:process'
import axios from 'axios'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

export const searchByGoogle = {
  name: 'searchByGoogle',
  description: '通过Google搜索网页内容，提取网页信息',
  parameters: {
    keyword: {
      type: 'string',
      description: '要搜索的关键词',
    },
    required: ['keyword'],
  },
  executor: async (params: Record<string, any>) => {
    try {
      const keyword = params.keyword as string
      console.log(`正在搜索: ${keyword}`)

      // 从环境变量获取 API 密钥和搜索引擎 ID
      const API_KEY = process.env.GOOGLE_API_KEY
      const SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID

      if (!API_KEY || !SEARCH_ENGINE_ID) {
        throw new Error('缺少必要的环境变量：GOOGLE_API_KEY 或 GOOGLE_SEARCH_ENGINE_ID')
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
