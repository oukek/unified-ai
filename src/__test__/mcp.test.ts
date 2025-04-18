import { z } from 'zod'
import { GeminiModel } from '../models/gemini'
import { UnifiedAI } from '../models/unified'
import { AgentCallback, ResponseFormat } from '../types'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import 'dotenv/config'
import { CustomModel } from './customModel'

// 使用通过 npm 安装的 @modelcontextprotocol/server-filesystem 服务
describe('MCP with filesystem tests', () => {
  let unifiedAI: UnifiedAI
  let mcpClient: Client
  let cleanup: () => Promise<void>
  let agentCallback: AgentCallback

  beforeAll(async () => {
    try {
      // 创建基础模型实例
      const baseModel = new CustomModel({
        apiKey: process.env.GEMINI_API_KEY ?? '',
      })
      
      // 创建UnifiedAI实例
      unifiedAI = new UnifiedAI(baseModel, {
        autoExecuteFunctions: true,
        maxRecursionDepth: 5,
      })
      
      // 创建MCP客户端
      mcpClient = new Client({ name: 'test-client', version: '1.0.0' })
      const transport = new StdioClientTransport({
        command: 'npx',
        args: [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "/Users/codebear/okew/unifiedAI/src/__test__",
        ],
      })
      
      // 连接到传输层
      await mcpClient.connect(transport)
      
      // 将MCP客户端添加到UnifiedAI
      unifiedAI.useMcp(mcpClient)

      unifiedAI.addFunction({
        name: 'randomNumber',
        description: 'get a random number between min and max',
        parameters: z.object({
          min: z.number().optional(),
          max: z.number().optional(),
        }),
        executor: async ({ min, max }) => {
          const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min
          return randomNumber
        },
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
