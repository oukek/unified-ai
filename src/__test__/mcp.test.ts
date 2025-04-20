import type { AgentCallback, ErrorEventData, FunctionCallEndEventData, FunctionCallStartEventData, ResponseEndEventData, ResponseStartEventData } from '../types'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { GeminiModel } from '../models/gemini'
import { UnifiedAI } from '../models/unified'
import { AgentEventType } from '../types'
import 'dotenv/config'

// 使用通过 npm 安装的 @modelcontextprotocol/server-filesystem 服务
describe('mCP with filesystem tests', () => {
  let unifiedAI: UnifiedAI
  let mcpClient: Client
  let cleanup: () => Promise<void>
  let agentCallback: AgentCallback

  beforeAll(async () => {
    try {
      // 创建基础模型实例
      const baseModel = new GeminiModel({
        apiKey: process.env.GEMINI_API_KEY ?? '',
      })

      // 创建UnifiedAI实例
      unifiedAI = new UnifiedAI(baseModel, {
        autoExecuteFunctions: true,
        maxRecursionDepth: 10,
      })

      // 创建MCP客户端
      mcpClient = new Client({ name: 'test-client', version: '1.0.0' })
      const transport = new StdioClientTransport({
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          '/Users/codebear/okew/unifiedAI/src/__test__',
        ],
      })

      // 连接到传输层
      await mcpClient.connect(transport)

      // 将MCP客户端添加到UnifiedAI
      unifiedAI.useMcp(mcpClient)

      unifiedAI.addFunction({
        name: 'randomNumber',
        description: 'get a random number between min and max',
        parameters: {
          min: {
            type: 'number',
            description: 'min number',
          },
          max: {
            type: 'number',
            description: 'max number',
          },
          required: ['min', 'max'],
        },
        executor: async ({ min, max }) => {
          const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min
          return randomNumber
        },
      })

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

      // 设置清理函数
      cleanup = async () => {
        await mcpClient.close()
      }
    }
    catch (error) {
      console.error('Error setting up MCP client:', error)
      throw error
    }
  }, 30000)

  afterAll(async () => {
    if (cleanup) {
      await cleanup()
    }
  })

  it('should create, write to, and read from a file using MCP', async () => {
    const prompt = `在 /Users/codebear/okew/unifiedAI/src/__test__/temp 目录下创建一个 test.txt，然后获取一个10-100之间的数字，然后把数字在 test.txt 里，然后再重新读取 test.txt 里的内容，返回给我，中文回答我`

    const response = await unifiedAI.unifiedChat(prompt, undefined, agentCallback)
    console.log('MCP Response:', response.content)

    // 验证响应中包含了文件内容
    expect(response.content).toContain('test.txt')
    expect(typeof response.content).toBe('string')

    // 验证响应中包含数字（文件内容）
    const responseText = response.content as string
    const containsNumber = /\d+/.test(responseText)
    expect(containsNumber).toBe(true)
  }, 30000) // 设置超时为30秒，因为可能需要更多时间
})
