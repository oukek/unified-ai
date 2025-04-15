# UnifiedAI

一个统一的AI接口库，用于简化与多种AI模型的交互。

## 简介

`@oukek/unified-ai` 是一个SDK，它提供了统一的接口来访问和使用各种AI模型，简化了开发过程，让开发者可以更加专注于应用功能的开发，而不必担心底层AI模型API的差异。通过统一的接口设计，您可以轻松切换不同的AI模型，而无需修改业务代码。

## 特性

- 统一的API接口设计，一套代码适配多种模型
- 支持多种主流AI模型（如Gemini等）
- 支持标准响应和流式响应两种交互模式
- 强大的Agent功能（函数调用），支持链式调用执行
- 支持Model Context Protocol (MCP)，可与文件系统等外部工具交互
- 内置JSON修复功能，自动处理模型返回的非标准JSON
- 完全TypeScript支持，提供完善的类型定义

## 支持的模型

- **Gemini**: 支持Google的Gemini系列模型
- **自定义模型**: 支持扩展实现自定义模型

## 安装

使用npm:
```bash
npm install @oukek/unified-ai
```

使用yarn:
```bash
yarn add @oukek/unified-ai
```

使用pnpm:
```bash
pnpm add @oukek/unified-ai
```

## 基本用法

### 初始化

首先需要初始化一个基础模型，然后将其传递给UnifiedAI：

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'

// 初始化基础模型
const geminiModel = new GeminiModel({
  apiKey: 'your_gemini_api_key_here', // 或从环境变量读取
  model: 'gemini-2.0-flash' // 指定模型名称
})

// 初始化UnifiedAI
const ai = new UnifiedAI(geminiModel, {
  // 配置选项
  maxRecursionDepth: 25, // 最大函数调用递归次数
})
```

### 基本聊天

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'

// 初始化基础模型和UnifiedAI
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel)

// 发送聊天请求
async function chat() {
  try {
    const response = await ai.unifiedChat('你好，请介绍一下自己')
    console.log('AI回复:', response.content)
    console.log('模型:', response.model)
  }
  catch (error) {
    console.error('聊天请求失败:', error)
  }
}

chat()
```

### 流式响应

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'

// 初始化
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel)

// 流式聊天
async function streamChat() {
  try {
    const generator = ai.unifiedChatStream('请讲一个故事')
    
    for await (const chunk of generator) {
      // 每个chunk.content是一个文本片段
      process.stdout.write(chunk.content as string) // 实时显示
      
      if (chunk.isLast) {
        console.log('\n故事完成！使用的模型:', chunk.model)
      }
    }
  }
  catch (error) {
    console.error('流式聊天请求失败:', error)
  }
}

streamChat()
```

### 添加和使用Agent功能（函数调用）

UnifiedAI支持函数调用，可以让AI助手执行特定操作：

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'
import { z } from 'zod'

// 初始化
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel)

// 添加函数（使用Zod验证参数）
ai.addFunction({
  name: 'getCurrentWeather',
  description: '获取指定城市的当前天气',
  parameters: z.object({
    city: z.string({
      description: '城市名称'
    })
  }),
  executor: async (params) => {
    // 实际实现会调用天气API
    return {
      temperature: 25,
      unit: 'celsius',
      condition: '晴天',
      city: params.city
    }
  }
})

// 使用带函数调用的聊天
async function chatWithFunctions() {
  const response = await ai.unifiedChat('北京今天的天气怎么样？')
  console.log('AI回复:', response.content)
  
  // 检查是否有函数调用
  if (response.functionCalls && response.functionCalls.length > 0) {
    console.log('函数调用:', response.functionCalls)
  }
}

chatWithFunctions()
```

### 多个函数和链式调用

可以添加多个函数并支持链式调用：

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'
import { z } from 'zod'

// 初始化
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel, {
  maxRecursionDepth: 3, // 设置最大递归深度
})

// 添加天气查询函数
ai.addFunction({
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
})

// 添加温度转换函数
ai.addFunction({
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
})

// 链式调用示例
async function chainedFunctionCalls() {
  // AI将自动调用getWeather获取温度，然后调用convertTemperature进行转换
  const response = await ai.unifiedChat(
    '北京今天的温度是多少摄氏度？请同时告诉我对应的华氏度。'
  )
  console.log('AI回复:', response.content)
}

chainedFunctionCalls()
```

### JSON响应格式

可以指定AI返回JSON格式的数据：

```typescript
import { GeminiModel, UnifiedAI, ResponseFormat } from '@oukek/unified-ai'

// 初始化
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel)

// 请求JSON格式响应
async function getJsonResponse() {
  const jsonPrompt = `请提供北京和上海的基本信息，包括人口、面积、所属国家和建城时间`

  const response = await ai.unifiedChat(
    jsonPrompt,
    { responseFormat: ResponseFormat.JSON }
  )

  // 响应已自动解析为JavaScript对象
  console.log('城市信息:', response.content)
  
  // 可以直接访问对象属性
  if (response.content.cities) {
    console.log('北京人口:', response.content.cities['北京'].population)
  }
}

getJsonResponse()
```

### 使用回调函数监控过程

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'

// 初始化
const geminiModel = new GeminiModel({
  apiKey: process.env.GEMINI_API_KEY
})
const ai = new UnifiedAI(geminiModel)

// 定义回调函数
const callback = (state: string, data: any) => {
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
      const content = typeof data.response.content === 'string' 
        ? data.response.content 
        : JSON.stringify(data.response.content)
      console.log(`[${timestamp}] 🏁 回答完成，长度: ${content.length}字符`)
      break

    case 'error':
      console.error(`[${timestamp}] ❌ 错误:`, data.error)
      break
  }
}

// 使用回调函数
async function chatWithCallback() {
  const response = await ai.unifiedChat('帮我查询深圳的天气', undefined, callback)
  console.log('AI回复:', response.content)
}

chatWithCallback()
```

### Model Context Protocol (MCP) 支持

UnifiedAI支持通过MCP协议与外部工具（如文件系统）进行交互：

```typescript
import { GeminiModel, UnifiedAI } from '@oukek/unified-ai'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { z } from 'zod'

async function setupAIWithMCP() {
  // 创建基础模型实例
  const baseModel = new GeminiModel({
    apiKey: process.env.GEMINI_API_KEY
  })
  
  // 创建UnifiedAI实例
  const ai = new UnifiedAI(baseModel, {
    maxRecursionDepth: 5,
  })
  
  // 创建MCP客户端
  const mcpClient = new Client({ name: 'mcp-client', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: 'npx',
    args: [
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "/path/to/workspace",
    ],
  })
  
  // 连接到传输层
  await mcpClient.connect(transport)
  
  // 将MCP客户端添加到UnifiedAI
  ai.useMcp(mcpClient)
  
  // 添加自定义函数
  ai.addFunction({
    name: 'randomNumber',
    description: '获取指定范围内的随机数',
    parameters: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }),
    executor: async ({ min = 1, max = 100 }) => {
      return Math.floor(Math.random() * (max - min + 1)) + min
    },
  })
  
  // 使用MCP功能与文件系统交互
  const response = await ai.unifiedChat(
    '创建一个test.txt文件，写入一个10-100之间的随机数，然后读取并告诉我内容'
  )
  
  console.log('AI回复:', response.content)
  
  // 关闭MCP连接
  await mcpClient.close()
}

setupAIWithMCP()
```

## API文档

### BaseModel

所有AI模型的基类，定义了统一的接口。

#### 方法

- `unifiedChat(prompt: string, options?: ChatOptions): Promise<ChatResponse>`  
  发送聊天请求并获取响应。
  
- `unifiedChatStream(prompt: string, options?: ChatOptions): AsyncGenerator<ChatStreamChunk>`  
  以流的形式获取聊天响应。
  
- `getModel(): string`  
  获取底层模型信息。

### UnifiedAI

UnifiedAI类扩展了BaseModel，并添加了Agent功能支持。

#### 构造函数

```typescript
constructor(
  baseModel: BaseModel, 
  options?: {
    functions?: AgentFunction[];
    maxRecursionDepth?: number;
    [key: string]: any;
  }
)
```

#### 方法

- `unifiedChat(prompt: string, options?: ChatOptions, callback?: AgentCallback): Promise<ChatResponse>`  
  发送聊天请求并获取响应，支持函数调用。
  
- `unifiedChatStream(prompt: string, options?: ChatOptions, callback?: AgentCallback): AsyncGenerator<ChatStreamChunk>`  
  以流的形式获取聊天响应，支持函数调用。

- `getModel(): string`  
  获取底层模型信息。

- `addFunction(func: AgentFunction): void`  
  添加一个Agent功能（函数）。

- `addFunctions(functions: AgentFunction[]): void`  
  添加多个Agent功能（函数）。

- `useMcp(client: Client): this`  
  设置MCP客户端，支持与外部工具交互。

### GeminiModel

Gemini模型的实现类。

#### 构造函数

```typescript
constructor(options: {
  apiKey: string;
  model?: string;
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
})
```

## 类型定义

### ChatOptions

```typescript
interface ChatOptions {
  /** 聊天历史记录 */
  history?: ChatMessage[];
  /** 模型名称 */
  model?: string;
  /** 温度参数 (0-1)，控制输出的随机性 */
  temperature?: number;
  /** 最大输出长度 */
  maxTokens?: number;
  /** 响应格式 */
  responseFormat?: ResponseFormat;
  /** 自定义模型参数 */
  [key: string]: any;
}
```

### AgentFunction

```typescript
interface AgentFunction {
  /** 函数名称 */
  name: string;
  /** 函数描述 */
  description?: string;
  /** 函数参数模式（可使用zod进行定义） */
  parameters: z.ZodObject<any> | Record<string, any>;
  /** 函数执行器 */
  executor?: (params: Record<string, any>) => Promise<any>;
}
```

### FunctionCall

```typescript
interface FunctionCall {
  /** 函数名称 */
  name: string;
  /** 函数参数 */
  arguments: Record<string, any>;
  /** 函数执行结果 */
  result?: any;
}
```

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test
```

## 许可证

MIT
