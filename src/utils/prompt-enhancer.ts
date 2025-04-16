import type { AgentFunction } from '../types'
import { ResponseFormat } from '../types'

/**
 * 提示增强器
 * 用于增强聊天提示，添加函数定义和调用格式说明
 */
export class PromptEnhancer {
  /**
   * 增强聊天提示，添加函数定义和调用格式
   * @param prompt 原始提示
   * @param functions 可用函数列表
   * @returns 增强后的提示
   */
  static enhancePrompt(prompt: string, functions: AgentFunction[]): string {
    if (functions.length === 0) {
      return prompt
    }

    // 构建函数定义的JSON格式
    const functionDefinitions = functions.map(f => ({
      name: f.name,
      description: f.description,
      parameters: f.parameters,
    }))

    // 添加函数说明和规范的调用格式
    return `${prompt}

你可以调用以下工具，请务必严格使用下列工具名称和参数，工具名称必须保持一致，不得修改或新增：
工具列表：
${JSON.stringify(functionDefinitions, null, 2)}

调用工具时，请严格按照以下标准 JSON 格式输出：
- 只使用提供的工具名称，不得自行创建或更改工具名称；
- 严格按照以上 JSON 格式输出，不要添加其他多余的文本或格式。

1当需要调用一个或多个工具时，请严格使用如下格式，包括前后的标签：
<==start_tool_calls==>
{
  "function_calls": [
    {
      "name": "工具名称1",
      "arguments": {
        "参数名": "参数值"
      }
    },
    {
      "name": "工具名称2",
      "arguments": {
        "参数名": "参数值"
      }
    }
  ]
}
<==end_tool_calls==>`
  }

  /**
   * 创建函数执行后的跟进提示
   * @param originalPrompt 原始用户提示
   * @param previousResponse 上一次模型的响应
   * @param functionResultsSummary 函数执行结果摘要
   * @param responseFormat 响应格式要求
   * @returns 跟进提示
   */
  static createFollowupPrompt(
    originalPrompt: string,
    previousResponse: string,
    functionResultsSummary: string,
    responseFormat?: ResponseFormat,
  ): string {
    return `
My previous question was: ${originalPrompt}

Your response was:
${previousResponse}

Here are the results of the function calls:
${functionResultsSummary}

Please generate a final response that incorporates all this information. If you need to call additional functions, please clearly indicate this.
${responseFormat === ResponseFormat.JSON ? '\nReturn your response in valid JSON format.' : ''}
`
  }
}
