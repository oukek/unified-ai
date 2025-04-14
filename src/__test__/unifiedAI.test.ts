import type { AgentCallback, AgentFunction } from '../models/unified'
import { GeminiModel } from '../models/gemini'

import { UnifiedAI } from '../models/unified'
import { ResponseFormat } from '../types'
import 'dotenv/config'

describe('unifiedAI tests', () => {
  let unifiedAI: UnifiedAI
  let agentCallback: AgentCallback

  beforeEach(() => {
    // 创建基础模型实例
    const baseModel = new GeminiModel({
      apiKey: process.env.GEMINI_API_KEY ?? '',
    })

    // 定义代理功能函数
    const weatherFunction: AgentFunction = {
      name: 'getWeather',
      description: '获取指定城市的天气信息',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称',
          },
        },
        required: ['city'],
      },
      executor: async (params) => {
        const { city } = params
        // 模拟API调用
        return {
          city,
          temperature: Math.floor(Math.random() * 30) + 5,
          condition: ['晴朗', '多云', '小雨', '大雨'][Math.floor(Math.random() * 4)],
          humidity: Math.floor(Math.random() * 60) + 40,
        }
      },
    }

    const calculatorFunction: AgentFunction = {
      name: 'calculate',
      description: '执行简单的数学计算',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，例如 "2 + 2"',
          },
        },
        required: ['expression'],
      },
      executor: async (params) => {
        const { expression } = params
        try {
          // 注意：仅用于示例，不要在实际应用中使用eval
          // eslint-disable-next-line no-eval
          const result = eval(expression)
          return { result }
        }
        catch {
          return { error: '无效的表达式' }
        }
      },
    }

    const temperatureConverterFunction: AgentFunction = {
      name: 'convertTemperature',
      description: '将温度从摄氏度转换为华氏度，或从华氏度转换为摄氏度',
      parameters: {
        type: 'object',
        properties: {
          temperature: {
            type: 'number',
            description: '要转换的温度值',
          },
          fromUnit: {
            type: 'string',
            description: '原始温度单位 (C 或 F)',
            enum: ['C', 'F'],
          },
        },
        required: ['temperature', 'fromUnit'],
      },
      executor: async (params) => {
        const { temperature, fromUnit } = params

        if (fromUnit === 'C') {
          const fahrenheit = (temperature * 9 / 5) + 32
          return { result: fahrenheit, unit: 'F' }
        }
        else {
          const celsius = (temperature - 32) * 5 / 9
          return { result: celsius, unit: 'C' }
        }
      },
    }

    const cityInfoFunction: AgentFunction = {
      name: 'getCityInfo',
      description: '获取城市基本信息，包括人口、面积等',
      parameters: {
        type: 'object',
        properties: {
          city: {
            type: 'string',
            description: '城市名称',
          },
        },
        required: ['city'],
      },
      executor: async (params) => {
        const { city } = params
        const citys: Record<string, any> = {
          北京: { population: '2100万', area: '16410平方公里', country: '中国', founded: '公元前1045年' },
          上海: { population: '2400万', area: '6340平方公里', country: '中国', founded: '公元751年' },
          广州: { population: '1500万', area: '7434平方公里', country: '中国', founded: '公元前214年' },
          深圳: { population: '1300万', area: '1997平方公里', country: '中国', founded: '1979年' },
        }
        // 模拟数据
        const cityInfo = citys[city] || { population: '未知', area: '未知', country: '未知', founded: '未知' }

        return {
          city,
          ...cityInfo,
        }
      },
    }

    // 创建UnifiedAI实例
    unifiedAI = new UnifiedAI(baseModel, {
      functions: [weatherFunction, calculatorFunction, temperatureConverterFunction, cityInfoFunction],
      autoExecuteFunctions: true,
      maxRecursionDepth: 3,
    })

    // 创建回调函数
    agentCallback = jest.fn((state, data) => {
      const timestamp = new Date().toISOString()

      switch (state) {
        case 'response_start':
          console.log(`[${timestamp}] 🟢 开始回答: "${data.prompt}"`)
          break

        case 'function_call_start':
          console.log(`[${timestamp}] 🔄 调用函数: ${data.functionCalls.map((f: any) => f.name).join(', ')}`)
          break

        case 'function_call_end':
          console.log(`[${timestamp}] ✅ 函数执行完成: ${data.functionCalls.map((f: any) => f.name).join(', ')}`)
          break

        case 'response_chunk':
          // 流式响应的每个块，这里不打印避免干扰输出
          break

        case 'response_end':
          const content = typeof data.response.content === 'string' ? data.response.content : JSON.stringify(data.response.content)
          console.log(`[${timestamp}] 🏁 回答完成，长度: ${content.length}字符`)
          break

        case 'error':
          console.error(`[${timestamp}] ❌ 错误:`, data.error)
          break
      }
    })
  })

  // 基本响应测试
  it('基本问答测试', async () => {
    const response = await unifiedAI.unifiedChat('请用中文介绍一下自己')
    expect(response.content).toBeTruthy()
  }, 30000)

  // 函数调用测试
  it('天气查询功能测试', async () => {
    const response = await unifiedAI.unifiedChat(
      '请用中文回答，北京今天天气怎么样？',
      {},
      agentCallback,
    )
    expect(response.content).toBeTruthy()
    expect(agentCallback).toHaveBeenCalled()
  }, 30000)

  // 计算功能测试
  it('计算功能测试', async () => {
    const response = await unifiedAI.unifiedChat('请用中文回答，计算123乘以456等于多少？')
    expect(response.content).toBeTruthy()
  }, 30000)

  // 链式函数调用测试
  it('链式函数调用测试', async () => {
    const response = await unifiedAI.unifiedChat(
      '请用中文回答，北京今天的温度是多少摄氏度？请同时告诉我对应的华氏度。',
      {},
      agentCallback,
    )
    expect(response.content).toBeTruthy()
    expect(agentCallback).toHaveBeenCalled()
  }, 30000)

  // 流式响应测试
  it('流式响应测试', async () => {
    const prompt = '请用中文给我讲个故事，然后帮我计算3的平方是多少'

    const contentParts = []
    for await (const chunk of unifiedAI.unifiedChatStream(prompt)) {
      if (typeof chunk.content === 'string') {
        contentParts.push(chunk.content)
      }
    }

    const content = contentParts.join('')
    expect(content).toBeTruthy()
  }, 30000)

  // 流式响应的函数链调用测试
  it('流式响应链式函数调用测试', async () => {
    const prompt = '请用中文回答，今天上海的温度是多少摄氏度？请将其转换为华氏度并告诉我'

    const contentParts = []
    for await (const chunk of unifiedAI.unifiedChatStream(prompt, {}, agentCallback)) {
      if (typeof chunk.content === 'string') {
        contentParts.push(chunk.content)
      }
    }

    const content = contentParts.join('')
    expect(content).toBeTruthy()
    expect(agentCallback).toHaveBeenCalled()
  }, 30000)

  // JSON格式响应测试
  it('jSON格式响应测试', async () => {
    const jsonPrompt = '请提供北京和上海的基本信息，包括人口、面积、所属国家和建城时间'

    const jsonResponse = await unifiedAI.unifiedChat(
      jsonPrompt,
      { responseFormat: ResponseFormat.JSON },
      agentCallback,
    )

    expect(jsonResponse.content).toBeTruthy()
    expect(typeof jsonResponse.content).toBe('object')

    // 转换为特定类型进行断言
    interface CityInfoResponse {
      cities?: { [city: string]: { population: string, area: string, country: string, founded: string } }
      result?: any
    }

    const typedContent = jsonResponse.content as CityInfoResponse
    if (typedContent.cities) {
      expect(typedContent.cities['北京']).toBeDefined()
      expect(typedContent.cities['上海']).toBeDefined()
    }
  }, 30000)
})
