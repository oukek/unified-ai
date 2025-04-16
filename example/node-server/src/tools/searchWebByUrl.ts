import axios from 'axios'

export const searchWebByUrl = {
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
