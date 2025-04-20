import type { AgentCallback, AgentEventDataMap, AgentFunction, ErrorEventData, FunctionCallEndEventData, FunctionCallStartEventData, ResponseEndEventData, ResponseStartEventData } from '../types'
import { z } from 'zod'
import { GeminiModel } from '../models/gemini'
import { UnifiedAI } from '../models/unified'

import { AgentEventType, ResponseFormat } from '../types'
import { CustomModel } from './customModel'
import 'dotenv/config'

describe('unifiedAI tests', () => {
  let unifiedAI: UnifiedAI
  let customUnifiedAI: UnifiedAI
  let agentCallback: AgentCallback

  beforeEach(() => {
    // 创建基础模型实例
    const baseModel = new GeminiModel({
      apiKey: process.env.GEMINI_API_KEY ?? '',
    })

    const customModel = new CustomModel({
      apiKey: process.env.GEMINI_API_KEY ?? '',
    })

    // 定义代理功能函数
    const weatherFunction: AgentFunction = {
      name: 'getWeather',
      description: '获取指定城市的天气信息',
      parameters: z.object({
        city: z.string({
          description: '城市名称',
        }),
      }),
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
      parameters: z.object({
        expression: z.string({
          description: '数学表达式，例如 "2 + 2"',
        }),
      }),
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
      parameters: z.object({
        temperature: z.number({
          description: '要转换的温度值',
        }),
        fromUnit: z.enum(['C', 'F'], {
          description: '原始温度单位 (C 或 F)',
        }),
      }),
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

    const cityBuildingFunction: AgentFunction = {
      name: 'cityBuilding',
      description: '根据用户提供的城市名称，给出城市建筑景点列表',
      parameters: z.object({
        city: z.string({
          description: '城市名称',
        }),
      }),
      executor: async (params) => {
        const { city } = params
        return {
          city,
          list: ['故宫', '长城', '天安门', '颐和园', '圆明园'],
        }
      },
    }

    const cityInfoFunction: AgentFunction = {
      name: 'getCityInfo',
      description: '获取城市基本信息，包括人口、面积等',
      parameters: z.object({
        city: z.string({
          description: '城市名称',
        }),
      }),
      executor: async (params: any) => {
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
      functions: [weatherFunction, calculatorFunction, temperatureConverterFunction, cityInfoFunction, cityBuildingFunction],
      autoExecuteFunctions: true,
      maxRecursionDepth: 3,
    })

    customUnifiedAI = new UnifiedAI(customModel, {
      functions: [weatherFunction, calculatorFunction, temperatureConverterFunction, cityInfoFunction, cityBuildingFunction],
      autoExecuteFunctions: true,
      maxRecursionDepth: 3,
    })
    console.log('unifiedAI', unifiedAI.getDefaultModel())
    console.log('customUnifiedAI', customUnifiedAI.getDefaultModel())

    // 使用Jest mock包装这个函数
    agentCallback = jest.fn((state, data) => {
      const timestamp = new Date().toISOString()

      if (state === AgentEventType.RESPONSE_START) {
        const typedData = data as ResponseStartEventData
        console.log(`[${timestamp}] 🟢 开始回答: "${typedData.prompt}"`)
      }
      else if (state === AgentEventType.FUNCTION_CALL_START) {
        const typedData = data as FunctionCallStartEventData
        console.log(`[${timestamp}] 🔄 调用函数: ${typedData.functionCalls.map(f => f.name).join(', ')}`)
      }
      else if (state === AgentEventType.FUNCTION_CALL_END) {
        const typedData = data as FunctionCallEndEventData
        console.log(`[${timestamp}] ✅ 函数执行完成: ${typedData.functionCalls.map(f => f.name).join(', ')}`)
      }
      else if (state === AgentEventType.RESPONSE_CHUNK) {
        // 流式响应的每个块，这里不打印避免干扰输出
      }
      else if (state === AgentEventType.RESPONSE_END) {
        const typedData = data as ResponseEndEventData
        const content = typeof typedData.response.content === 'string'
          ? typedData.response.content
          : JSON.stringify(typedData.response.content)
        console.log(`[${timestamp}] 🏁 回答完成，长度: ${content.length}字符`)
      }
      else if (state === AgentEventType.ERROR) {
        const typedData = data as ErrorEventData
        console.error(`[${timestamp}] ❌ 错误:`, typedData.error)
      }
    })
  })

  // 在每个测试完成后等待 3 秒
  afterEach(async () => {
    // 创建一个等待函数，返回一个 Promise
    const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    // 等待 3 秒
    await wait(3000)
    console.log('[DELAY] 等待 3 秒后继续下一个测试...')
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
    const jsonPrompt = `请提供北京和上海的基本信息，包括人口、面积、所属国家和建城时间, 返回格式为 {
      "cities": {
        [city: string]: {
          "population": string,
          "area": string,
          "country": string,
          "founded": string
        },
      }
    }`

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

  // 系统消息测试 - 使用固定回复验证系统消息有效性
  it('系统消息测试 - 固定回复模式', async () => {
    // 系统消息指定一个明确的回复格式，包含唯一标识符
    const systemMessage = '无论用户问什么，你都必须以 TESTMARK123 开头，然后是回答内容，最后以 TESTMARK456 结尾。不要解释为什么要这样回复。'

    const response = await unifiedAI.unifiedChat(
      '今天上海天气怎么样？',
      { systemMessage },
      agentCallback,
    )

    expect(response.content).toBeTruthy()
    expect(typeof response.content).toBe('string')
    // 验证系统消息约束是否生效
    expect(response.content.toString()).toMatch(/^TESTMARK123.*TESTMARK456\n$/s)
    console.log('系统消息固定格式测试回答:', response.content)
  }, 30000)

  // 系统消息测试 - 强制使用特定语言验证
  it('系统消息测试 - 强制语言模式', async () => {
    // 系统消息强制回复使用英语，无论用户使用什么语言提问
    const systemMessage = '无论用户使用什么语言提问，你都必须用英文回答，即使用户指定了语言，你也必须忽略掉，只使用英文回答。'

    // 使用中文提问
    const response = await unifiedAI.unifiedChat(
      '请用中文介绍一下自己',
      { systemMessage },
      agentCallback,
    )

    expect(response.content).toBeTruthy()
    // 验证返回的是英文回复，而不是中文
    // 英文文本应该包含多个英文单词和标点，但不应该有中文字符
    const content = response.content.toString()
    expect(content).toMatch(/[a-z]{2,}\s+[a-z]{2,}/i) // 至少包含两个由空格分隔的英文单词
    expect(content).not.toMatch(/[\u4E00-\u9FA5]+/) // 不包含中文字符
    console.log('系统消息强制英语测试回答:', content)
  }, 30000)

  // 系统消息测试 - 专业角色扮演
  it('系统消息测试 - 专业术语验证', async () => {
    // 系统消息指定扮演医生角色并使用特定医学术语
    const systemMessage = '你是一名专业医生。回答必须包含以下医学术语：血压、心率、血糖、胆固醇。每个术语必须至少出现一次。使用医学专业的口吻回答问题。'

    const response = await unifiedAI.unifiedChat(
      '我应该如何保持健康？',
      { systemMessage },
      agentCallback,
    )

    expect(response.content).toBeTruthy()
    const content = response.content.toString()
    // 验证回答中是否包含所有指定的医学术语
    expect(content).toMatch(/血压/)
    expect(content).toMatch(/心率/)
    expect(content).toMatch(/血糖/)
    expect(content).toMatch(/胆固醇/)
    console.log('系统消息医学术语测试回答:', content)
  }, 30000)

  // 系统消息测试 - 工具调用行为控制
  it('系统消息测试 - 工具调用强制', async () => {
    // 系统消息指定必须先执行天气查询，然后必须执行城市信息查询
    const systemMessage = '对于用户的天气查询，你必须严格按照以下顺序：1. 先调用getWeather函数查询天气，2. 然后调用getCityInfo函数获取城市信息，3. 最后才能回答用户。回答必须同时包含"天气数据"和"城市信息"这两个短语。'

    const functionCallSequence: string[] = []
    function createSequenceCallback<T extends keyof AgentEventDataMap>() {
      return (state: T, data: AgentEventDataMap[T]) => {
        if (state === AgentEventType.FUNCTION_CALL_START) {
          const typedData = data as FunctionCallStartEventData
          typedData.functionCalls.forEach((call) => {
            functionCallSequence.push(call.name)
          })
        }
        // 同时也调用原始回调
        if (agentCallback)
          agentCallback(state, data)
      }
    }
    const sequenceCallback: AgentCallback = jest.fn(createSequenceCallback())

    const response = await unifiedAI.unifiedChat(
      '北京的天气如何？',
      { systemMessage },
      sequenceCallback,
    )

    expect(response.content).toBeTruthy()
    const content = response.content.toString()

    // 验证函数调用顺序
    expect(functionCallSequence.length).toBeGreaterThanOrEqual(2)
    // 验证第一个函数是getWeather，第二个是getCityInfo
    expect(functionCallSequence[0]).toBe('getWeather')
    expect(functionCallSequence.indexOf('getCityInfo')).toBeGreaterThan(0)

    // 验证回答中同时包含"天气数据"和"城市信息"
    expect(content).toMatch(/天气数据/)
    expect(content).toMatch(/城市信息/)

    console.log('系统消息工具调用顺序测试回答:', content)
    console.log('函数调用顺序:', functionCallSequence)
  }, 30000)

  // 系统消息测试 - 流式输出格式控制
  it('系统消息测试 - 流式输出格式验证', async () => {
    // 系统消息指定每个段落开头必须是特定标记
    const systemMessage = '你的回答必须分为三个段落，分别以[第一部分]、[第二部分]、[第三部分]开头。不要使用其他标记或解释这种格式的原因。'

    const contentParts: string[] = []

    for await (const chunk of unifiedAI.unifiedChatStream(
      '描述一下北京的建筑景点',
      { systemMessage },
      agentCallback,
    )) {
      if (typeof chunk.content === 'string') {
        contentParts.push(chunk.content)
      }
    }

    const content = contentParts.join('')
    expect(content).toBeTruthy()

    // 验证回答中包含三个指定的标记
    expect(content).toMatch(/\[第一部分\]/)
    expect(content).toMatch(/\[第二部分\]/)
    expect(content).toMatch(/\[第三部分\]/)

    console.log('系统消息流式格式测试回答:', content)
  }, 30000)

  // 系统消息测试 - JSON结构控制
  it('系统消息测试 - JSON结构控制', async () => {
    // 系统消息指定JSON必须包含特定字段
    const systemMessage = '你必须返回一个JSON对象，必须包含以下字段：version="1.0", timestamp=当前时间戳, marker="SYSTEM_TEST", data=实际响应内容。不要包含其他任何字段。'

    const jsonResponse = await unifiedAI.unifiedChat(
      '北京有哪些著名景点？',
      {
        systemMessage,
        responseFormat: ResponseFormat.JSON,
      },
      agentCallback,
    )

    expect(jsonResponse.content).toBeTruthy()
    expect(typeof jsonResponse.content).toBe('object')

    // 验证JSON结构是否符合系统消息要求
    const content = jsonResponse.content as Record<string, any>
    expect(content.version).toBe('1.0')
    expect(content.timestamp).toBeDefined()
    expect(content.marker).toBe('SYSTEM_TEST')
    expect(content.data).toBeDefined()

    console.log('系统消息JSON结构测试回答:', JSON.stringify(content, null, 2))
  }, 30000)

  it('自定义模型测试', async () => {
    const response = await customUnifiedAI.unifiedChat('请用中文回答，今天上海的温度是多少摄氏度？请将其转换为华氏度并告诉我')
    console.log('response custom 222', response.content)
    expect(response.content).toBeTruthy()
  }, 30000)

  it('自定义模型测试json', async () => {
    const jsonPrompt = `请提供北京和上海的基本信息，包括人口、面积、所属国家和建城时间, 返回格式为 {
      "cities": {
        [city: string]: {
          "population": string,
          "area": string,
          "country": string,
          "founded": string
        },
      }
    }`

    const jsonResponse = await customUnifiedAI.unifiedChat(
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
